'use strict'

/**
 *  This is the token contract of Atlas Protocol on Nebulas blockchain based on NRC20 standards.
 *  Besides the NRC20 standards, it is also implemented a multiple signing mechanism to control
 *  token minting process and pause feature.
 **/

import {
  Governance,
  ROLE_EXEC,
  ROLE_CHAIR
} from "./governance"
import {
  extendsSerializable
} from './utils'
import {
  version
} from './package.json'

let AllowedProto = {
  toString() {
    return JSON.stringify(this.allowed)
  },

  _parseObj(data) {
    for (let key in data) {
      this.allowed[key] = new BigNumber(data[key])
    }
  },

  get(key) {
    return this.allowed[key]
  },

  set(key, value) {
    this.allowed[key] = new BigNumber(value)
  }
}

// transfer with allowance
let Allowed = function(obj) {
  this.allowed = {}
  this.parseObj(obj)
}

Allowed.prototype = extendsSerializable(AllowedProto)

// pause certain function for good reasons
let PauseProto = {
  _parseObj(data) {
    this._isPaused = false  // current contract pause status; true for paused;
    if (data.hasOwnProperty('_isPaused')) {
      this._isPaused = data['_isPaused']
    }
    // proposed pause transactions
    if (data.hasOwnProperty('_pauseTransactions')) {
      let txs = data['_pauseTransactions']
      for (let key in txs) {
        this._pauseTransactions[key] = new PauseTransaction(txs[key])
      }
    }
  },

  // the pause value need to be boolean
  _checkValue(value) {
    return typeof(value) == 'boolean'
  },

  create(nonce, value) {
    if (nonce <= 0) {
      throw new Error("only voting members can propose pause.")
    }

    if (this._pauseTransactions[nonce]) {
      throw new Error("reused nonce not allowed.")
    }

    if (!this._checkValue(value)) {
      throw new Error("invalid pause value.")
    }

    let pauseTx = {}
    pauseTx["_approvalNonce"] = nonce
    pauseTx["_value"] = value
    // save the proposal to a waiting list
    this._pauseTransactions[nonce] = new PauseTransaction(pauseTx)
  },
  // get pause propose detail
  getPauseTx(approvalNonce) {
    return this._pauseTransactions[approvalNonce]
  },
  // check if the system is paused
  isPaused() {
    return this._isPaused
  },
  // set the system pause status to approved pause value
  submit(approvalNonce) {
    let tx = this._pauseTransactions[approvalNonce]
    if (tx instanceof PauseTransaction && this._checkValue(tx["_value"])) {
      this._isPaused = tx["_value"]
      return tx
    }
    throw new Error("invalid pause transaction nonce.")
  }
}

let Pause = function(obj) {
  this._isPaused = false   // current contract pause status
  this._pauseTransactions = {}
  this.parseObj(obj)
}

Pause.prototype = extendsSerializable(PauseProto)

let PauseTransaction = function(obj) {
    this.parseObj(obj)
}

let PauseTransactionProto = {
  _parseObj(data) {
    if (data.hasOwnProperty('_approvalNonce')) {
      this._approvalNonce = data['_approvalNonce']
    }
    if (data.hasOwnProperty('_value')) {
      this._value = data['_value']
    }
  }
}

PauseTransaction.prototype = extendsSerializable(PauseTransactionProto)

let MintTransaction = function(obj) {
  this.parseObj(obj)
}

let MintTransactionProto = {
  _parseObj(data) {
    if (data.hasOwnProperty('_approvalNonce')) {
      this._approvalNonce = data['_approvalNonce']   // proposal index
    }
    if (data.hasOwnProperty('_to')) {
      this._to = data['_to']  // the address tokens minted to
    }
    if (data.hasOwnProperty('_value')) {
      this._value = data['_value']  // amount of minted token
    }
  }
}

MintTransaction.prototype = extendsSerializable(MintTransactionProto)

let Minter = function(obj) {
  this._remainingSupply = null  // remaining available amount; set on the deployment of contract
  this._mintTransactions = {}
  this.parseObj(obj)
}

let MinterProto = {
  _parseObj(data) {
    if (data.hasOwnProperty('_remainingSupply')) {
      this._remainingSupply = new BigNumber(data['_remainingSupply'])
    }
    if (data.hasOwnProperty('_mintTransactions')) {
      let txs = data['_mintTransactions']
      for (let key in txs) {
        this._mintTransactions[key] = new MintTransaction(txs[key])
      }
    }
  },

  _checkValue(value) {
    let v = value instanceof BigNumber ? value : (new BigNumber(value))
    return v.isFinite() && !v.isNaN() && v.gte(0)
  },

  _checkCanMint(value) {
    if (!this._checkValue(value) || !this._checkValue(this._remainingSupply)) {
      return false
    }
    return (new BigNumber(this._remainingSupply))
      .gte(new BigNumber(value))
  },

  create(nonce, to, value) {
    if (nonce <= 0) {
      throw new Error("only voting members can propose minting.")
    }

    if (this._mintTransactions.hasOwnProperty(nonce)) {
      throw new Error("reused nonce not allowed.")
    }

    if (!this._checkValue(value)) {
      throw new Error("invalid mint amount.")
    }

    if (!this._checkCanMint(value)) {
      throw new Error("insufficient supply remaining for minting.")
    }

    let mintTx = {}
    mintTx["_approvalNonce"] = nonce
    mintTx["_to"] = to
    mintTx["_value"] = value
    this._mintTransactions[nonce] = new MintTransaction(mintTx)
  },

  getMintTx(approvalNonce) {
    return this._mintTransactions[approvalNonce]
  },

  submit(approvalNonce) {
    let tx = this._mintTransactions[approvalNonce]
    if (tx === null || typeof tx === 'undefined') {
      throw new Error("invalid mint transaction nonce.")
    }
    return tx
  }
}

Minter.prototype = extendsSerializable(MinterProto)

let ATPToken = function() {
  LocalContractStorage.defineProperties(this, {
    _name: null,   // token name
    _symbol: null,  // token symbol
    _decimals: null, // decimal of token
    _totalSupply: {  // total supply of token
      parse(val) {
        return new BigNumber(val)
      },
      stringify(obj) {
        return obj.toString(10)
      }
    },
    governance: {
      parse(val) {
        return new Governance(val)
      },
      stringify(obj) {
        return obj.toString()
      }
    },
    minter: {
      parse(val) {
        return new Minter(val)
      },
      stringify(obj) {
        return obj.toString()
      }
    },
    pause: {
      parse(val) {
        return new Pause(val)
      },
      stringify(obj) {
        return obj.toString()
      }
    }
  })

  LocalContractStorage.defineMapProperties(this, {
    // balance ledger
    "balances": {
      parse(val) {
        return new BigNumber(val)
      },
      stringify(obj) {
        return obj.toString()
      }
    },
    "allowed": {
      parse(val) {
        return new Allowed(val)
      },
      stringify(obj) {
        return obj.toString()
      }
    }
  })
}

// Atlas Protocol, ATP, 18, 10,000,000,000
ATPToken.prototype = {
  init(name, symbol, decimals, totalSupply, govObj) {
    let wei = (new BigNumber(10)).pow(decimals)

    this._name = name
    this._symbol = symbol
    this._decimals = decimals | 0
    this._totalSupply = (new BigNumber(totalSupply)).mul(wei)
    this.minter = new Minter({
      _remainingSupply: this._totalSupply
    })
    this.governance = new Governance(govObj)  // governance implemented multiple signing mechanism
    this.pause = new Pause() // false by default
  },

  proposePause(value) {
    // propose to change the pause status
    let proposer = Blockchain.transaction.from
    let gov = this.governance
    let pause = this.pause
    let nonce = gov.propose(proposer)

    pause.create(nonce, value)
    this.governance = gov
    this.pause = pause

    return nonce
  },
  // approve pause propose
  approvePause(approvalNonce) {
    let from = Blockchain.transaction.from

    if(!this.governance.isAuthorized(from)){
        throw new Error(
            "unauthorized account.")
    }

    let gov = this.governance

    gov.approve(from, approvalNonce)
    this.governance = gov
  },

  submitPause(approvalNonce) {
    let from = Blockchain.transaction.from

    if(!this.governance.isAuthorized(from)){
        throw new Error(
            "unauthorized account.")
    }
    // change the system pause status
    let gov = this.governance
    if (!gov.submit(approvalNonce)) {
      throw new Error(
        "unauthorized pause transaction or transaction resubmitted.")
    }
    let pause = this.pause
    let pauseTx = pause.submit(approvalNonce)
    if (pauseTx instanceof PauseTransaction) {
      this.pauseEvent(pause.isPaused())
    }
    this.pause = pause
  },
  // get proposed pause info
  getPauseTx(approvalNonce) {
    return this.pause.getPauseTx(approvalNonce)
  },
  // check if the function is paused
  isPaused() {
    return this.pause.isPaused()
  },

  // Mint functions
  proposeMinting(to, value) {
    let proposer = Blockchain.transaction.from
    let gov = this.governance
    let minter = this.minter
    let nonce = gov.propose(proposer)
    minter.create(nonce, to, value)

    this.minter = minter
    this.governance = gov

    return nonce
  },
  // approved mint propose
  approveMinting(approvalNonce) {
    let from = Blockchain.transaction.from

    if(!this.governance.isAuthorized(from)){
        throw new Error(
            "unauthorized account.")
    }
    let gov = this.governance
    gov.approve(from, approvalNonce)
    this.governance = gov
  },
  // get proposed mint info
  getMintTx(approvalNonce) {
    return this.minter.getMintTx(approvalNonce)
  },

  submitMinting(approvalNonce) {
    let from = Blockchain.transaction.from

    if(!this.governance.isAuthorized(from)){
        throw new Error(
            "unauthorized account.")
    }
    // submit mint propose
    let gov = this.governance
    if (!gov.submit(approvalNonce)) {
      throw new Error(
        "unauthorized mint transaction or transaction resubmitted.")
    }
    let mint = this.minter
    let mintTx = mint.submit(approvalNonce)
    if (mintTx instanceof MintTransaction) {
      let from = Blockchain.transaction.from
      let amount = mintTx._value
      let to = mintTx._to
      let curBalance = this.balances.get(to) || new BigNumber(0)
      let newBalance = curBalance.add(new BigNumber(amount))
      if (mint._checkValue(newBalance) && mint._checkCanMint(amount)) {
        this.balances.set(to, newBalance)
        this.transferEvent(true, from, to, amount)
        mint._remainingSupply = mint._remainingSupply.sub(new BigNumber(amount))
      }
    }
    this.minter = mint
    this.governance = gov
  },

  currentSupply() {
    return this._totalSupply.sub(this.minter._remainingSupply).toString(10)
  },

  // Returns the name of the token
  name() {
    return this._name
  },

  // Returns the symbol of the token
  symbol() {
    return this._symbol
  },

  // Returns the number of decimals the token uses
  decimals() {
    return this._decimals
  },

  totalSupply() {
    return this._totalSupply.toString(10)
  },

  // token balance
  balanceOf(owner) {
    let balance = this.balances.get(owner)

    if (balance instanceof BigNumber) {
      return balance.toString(10)
    } else {
      return "0"
    }
  },

  // transfer token
  transfer(to, value) {
    if (this.isPaused()) {
      throw new Error("function suspended.")
    }

    value = new BigNumber(value)
    if (value.lt(0)) {
      throw new Error("invalid value.")
    }

    // from address
    let from = Blockchain.transaction.from
    let balance = this.balances.get(from) || new BigNumber(0)

    if (balance.lt(value)) {
      throw new Error("transfer failed.")
    }

    this.balances.set(from, balance.sub(value))
    let toBalance = this.balances.get(to) || new BigNumber(0)
    this.balances.set(to, toBalance.add(value))

    this.transferEvent(true, from, to, value)
  },

  // transfer token with allowed values
  transferFrom(from, to, value) {
    if (this.isPaused()) {
      throw new Error("function suspended.")
    }

    let spender = Blockchain.transaction.from
    let balance = this.balances.get(from) || new BigNumber(0)

    let allowed = this.allowed.get(from) || new Allowed()
    let allowedValue = allowed.get(spender) || new BigNumber(0)
    value = new BigNumber(value)

    if (value.lt(0)) {
      throw Error('transfer value must gte 0')
    }
    if (balance.lt(value)) {
      throw Error(`${from} insufficient balance`)
    }
    if (allowedValue.lt(value)) {
      throw Error(`${value} exceeds your allowance`)
    }

    this.balances.set(from, balance.sub(value))

    // update allowed value
    allowed.set(spender, allowedValue.sub(value))
    this.allowed.set(from, allowed)

    let toBalance = this.balances.get(to) || new BigNumber(0)
    this.balances.set(to, toBalance.add(value))

    this.transferEvent(true, from, to, value)
  },

  pauseEvent(value) {
    Event.Trigger(this.name(), {
      IsPaused: value,
    })
  },

  transferEvent(status, from, to, value) {
    Event.Trigger(this.name(), {
      Status: status,
      Transfer: {
        from: from,
        to: to,
        value: value
      }
    })
  },
  // approve allow amount
  approve(spender, currentValue, value) {
    let from = Blockchain.transaction.from

    let oldValue = this.allowance(from, spender)
    if (oldValue != currentValue.toString()) {
      throw new Error("current approve value mistake.")
    }

    let balance = new BigNumber(this.balanceOf(from))
    let val = new BigNumber(value)

    if (val.lt(0) || balance.lt(val)) {
      throw new Error("invalid value.")
    }

    let owned = this.allowed.get(from) || new Allowed()
    owned.set(spender, val)

    this.allowed.set(from, owned)

    this.approveEvent(true, from, spender, val)
  },

  approveEvent(status, from, spender, value) {
    Event.Trigger(this.name(), {
      Status: status,
      Approve: {
        owner: from,
        spender: spender,
        value: value
      }
    })
  },

  allowance(owner, spender) {
    let owned = this.allowed.get(owner)

    if (owned instanceof Allowed) {
      let spd = owned.get(spender)
      if (spd instanceof BigNumber) {
        return spd.toString(10)
      }
    }
    return "0"
  },

  version() {
    return version
  }
}

export default ATPToken
