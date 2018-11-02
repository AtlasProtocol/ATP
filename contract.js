'use strict';

let {
  Governance,
  ROLE_EXEC,
  ROLE_CHAIR
} = require('./governance.js');


Object.defineProperty(Object.prototype, "parseObj", {
  value: function(obj) {
    if (Object.prototype.toString.call(obj) === '[object String]') {
      this._parseObj(JSON.parse(obj));
    } else if (Object.prototype.toString.call(obj) === '[object Object]') {
      this._parseObj(obj);
    // } else {
    //   throw new Error('invalid param type')
    }
  },
  configurable: true
});

let Allowed = function(obj) {
  this.allowed = {};
  this.parseObj(obj);
};

Allowed.prototype = {
  toString() {
    return JSON.stringify(this.allowed)
  },

  _parseObj(data) {
    for (let key in data) {
      this.allowed[key] = new BigNumber(data[key]);
    }
  },

  get(key) {
    return this.allowed[key]
  },

  set(key, value) {
    this.allowed[key] = new BigNumber(value);
  }
};

let Pause = function(obj) {
  LocalContractStorage.defineProperty(this, '_isPaused');
  LocalContractStorage.defineMapProperty(this, '_pauseTransactions');
  this.parseObj(obj);
};

Pause.prototype = {
  toString() {
    return JSON.stringify(this)
  },

  _parseObj(data) {
    this._isPaused = false;
    if (data['_isPaused'] !== undefined) {
      this._isPaused = data['_isPaused'];
    }
    if (data['_pauseTransactions'] !== undefined) {
      let txs = data['_pauseTransactions'];
      for (let key in txs) {
        this._pauseTransactions[key] = new PauseTransaction(txs[key]);
      }
    }
  },

  _checkValue(value) {
    return typeof(value) == 'boolean'
  },

  create(nonce, value) {
    if (nonce <= 0) {
      throw new Error("only voting memebers can propose pause.")
    }

    if (this._pauseTransactions[nonce]) {
      throw new Error("reused nonce not allowed.")
    }

    if (!this._checkValue(value)) {
      throw new Error("invalid pause value.")
    }

    let pauseTx = {};
    pauseTx["_approvalNonce"] = nonce;
    pauseTx["_value"] = value;
    this._pauseTransactions[nonce] = new PauseTransaction(pauseTx);
  },

  getPauseTx(approvalNonce) {
    return this._pauseTransactions[approvalNonce]
  },

  isPaused() {
    return this._isPaused
  },

  submit(approvalNonce) {
    let tx = this._pauseTransactions[approvalNonce];
    if (tx === null || typeof tx === 'undefined') {
      throw new Error("invalid pause transaction nonce.")
    }
    return tx
  }
};

let PauseTransaction = function(obj) {
  this.parseObj(obj);
};

PauseTransaction.prototype = {
  toString() {
    return JSON.stringify(this)
  },

  _parseObj(data) {
    if (data['_approvalNonce'] !== undefined) {
      this._approvalNonce = data['_approvalNonce'];
    }

    if (data['_value'] !== undefined) {
      this._value = data['_value'];
    }
  }
};

let MintTransaction = function(obj) {
  this.parseObj(obj);
};

MintTransaction.prototype = {
  toString() {
    return JSON.stringify(this)
  },

  _parseObj(data) {
    if (data['_approvalNonce'] !== undefined) {
      this._approvalNonce = data['_approvalNonce'];
    }
    if (data['_to'] !== undefined) {
      this._to = data['_to'];
    }
    if (data['_value'] !== undefined) {
      this._value = data['_value'];
    }
  }
};

let Minter = function(obj) {
  LocalContractStorage.defineProperty(this, '_remainingSupply');
  LocalContractStorage.defineMapProperty(this, '_mintTransactions');
  this.parseObj(obj);
};

Minter.prototype = {
  toString() {
    return JSON.stringify(this)
  },

  _parseObj(data) {
    if (data['_remainingSupply'] !== undefined) {
      this._remainingSupply = new BigNumber(data['_remainingSupply']);
    }
    if (data['_mintTransactions'] !== undefined) {
      let txs = data['_mintTransactions'];
      for (let key in txs) {
        this._mintTransactions[key] = new MintTransaction(txs[key]);
      }
    }
  },

  _checkValue(value) {
    let v = value instanceof BigNumber ? value : (new BigNumber(value));
    return v.isFinite() && !v.isNaN() && v.gte(0)
  },

  _checkCanMint(value) {
    if (!this._checkValue(value) || !this._checkValue(this._remainingSupply)) {
      return false
    }
    return (new BigNumber(this._remainingSupply)).gte(new BigNumber(value))
  },

  create(nonce, to, value) {
    if (nonce <= 0) {
      throw new Error("only voting memebers can propose minting.")
    }

    if (this._mintTransactions[nonce]) {
      throw new Error("reused nonce not allowed.")
    }

    if (!this._checkValue(value)) {
      throw new Error("invalid mint amount.")
    }

    if (!this._checkCanMint(value)) {
      throw new Error("insufficient supply remaining for minting.")
    }

    let mintTx = {};
    mintTx["_approvalNonce"] = nonce;
    mintTx["_to"] = to;
    mintTx["_value"] = value;
    this._mintTransactions[nonce] = new MintTransaction(mintTx);
  },

  getMintTx(approvalNonce) {
    return this._mintTransactions[approvalNonce]
  },

  submit(approvalNonce) {
    let tx = this._mintTransactions[approvalNonce];
    if (tx === null || typeof tx === 'undefined') {
      throw new Error("invalid mint transaction nonce.")
    }
    return tx
  }
};

let ATPToken = function() {
  LocalContractStorage.defineProperties(this, {
    _name: null,
    _symbol: null,
    _decimals: null,
    _totalSupply: {
      parse(value) {
        return new BigNumber(value)
      },
      stringify(o) {
        return o.toString(10)
      }
    },
  });

  LocalContractStorage.defineMapProperties(this, {
    "balances": {
      parse(value) {
        return new BigNumber(value)
      },
      stringify(o) {
        return o.toString(10)
      }
    },
    "allowed": {
      parse(value) {
        return new Allowed(value)
      },
      stringify(o) {
        return o.toString()
      }
    }
  });
};

// Atlas Protocol, ATC, 18, 10,000,000,000
ATPToken.prototype = {
  init(name, symbol, decimals, totalSupply, govObj) {
    this._name = name;
    this._symbol = symbol;
    this._decimals = decimals | 0;
    this._totalSupply = new BigNumber(totalSupply)
      .mul(new BigNumber(10)
        .pow(decimals));

    this.minter = new Minter(JSON.stringify({
      '_remainingSupply': this._totalSupply
    }));
    this.governance = new Governance(govObj);
    this.pause = new Pause();
  },

  proposePause(value) {
    let proposer = Blockchain.transaction.from;
    let nonce = this.governance.propose(proposer);
    this.pause.create(nonce, value);
    return nonce
  },

  approvePause(approvalNonce) {
    let from = Blockchain.transaction.from;
    this.governance.approve(from, approvalNonce);
  },

  submitPause(approvalNonce) {
    if (!this.governance.submit(approvalNonce)) {
      throw new Error(
        "unauthorized pause transaction or transaction resubmitted.")
    }
    let pauseTx = this.pause.submit(approvalNonce);
    if (pauseTx instanceof PauseTransaction) {
      if (this.pause._checkValue(pauseTx["_value"])) {
        this.pause._isPaused = pauseTx["_value"];
        this.pauseEvent(this.pause.isPaused());
      }
    }
  },

  getPauseTx(approvalNonce) {
    return this.pause.getPauseTx(approvalNonce)
  },

  isPaused() {
    return this.pause.isPaused()
  },

  // Mint functions
  proposeMinting(to, value) {
    let proposer = Blockchain.transaction.from;
    let nonce = this.governance.propose(proposer);
    this.minter.create(nonce, to, value);
    return nonce
  },

  approveMinting(approvalNonce) {
    let from = Blockchain.transaction.from;
    this.governance.approve(from, approvalNonce);
  },

  getMintTx(approvalNonce) {
    return this.minter.getMintTx(approvalNonce)

  },

  submitMinting(approvalNonce) {
    if (!this.governance.submit(approvalNonce)) {
      throw new Error(
        "unauthorized mint transaction or transaction resubmitted.")
    }
    let mintTx = this.minter.submit(approvalNonce);
    if (mintTx instanceof MintTransaction) {
      let from = Blockchain.transaction.from;
      let amount = mintTx._value;
      let to = mintTx._to;
      let curBalance = this.balances.get(to) || new BigNumber(0);
      let newBalance = curBalance.add(new BigNumber(amount));
      if (this.minter._checkValue(newBalance) && this.minter._checkCanMint(
          amount)) {
        this.balances.set(to, newBalance);
        this.transferEvent(true, from, to, this.amount);
        this.minter._remainingSupply.sub(new BigNumber(amount));
      }
    }
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

  balanceOf(owner) {
    let balance = this.balances.get(owner);

    if (balance instanceof BigNumber) {
      return balance.toString(10)
    } else {
      return "0"
    }
  },

  transfer(to, value) {
    if (this.isPaused()) {
      throw new Error("function suspended.")
    }

    value = new BigNumber(value);
    if (value.lt(0)) {
      throw new Error("invalid value.")
    }

    let from = Blockchain.transaction.from;
    let balance = this.balances.get(from) || new BigNumber(0);

    if (balance.lt(value)) {
      throw new Error("transfer failed.")
    }

    this.balances.set(from, balance.sub(value));
    let toBalance = this.balances.get(to) || new BigNumber(0);
    this.balances.set(to, toBalance.add(value));

    this.transferEvent(true, from, to, value);
  },

  transferFrom(from, to, value) {
    if (this.isPaused()) {
      throw new Error("function suspended.")
    }

    let spender = Blockchain.transaction.from;
    let balance = this.balances.get(from) || new BigNumber(0);

    let allowed = this.allowed.get(from) || new Allowed();
    let allowedValue = allowed.get(spender) || new BigNumber(0);
    value = new BigNumber(value);

    if (value.gte(0) && balance.gte(value) && allowedValue.gte(value)) {

      this.balances.set(from, balance.sub(value));

      // update allowed value
      allowed.set(spender, allowedValue.sub(value));
      this.allowed.set(from, allowed);

      let toBalance = this.balances.get(to) || new BigNumber(0);
      this.balances.set(to, toBalance.add(value));

      this.transferEvent(true, from, to, value);
    } else {
      throw new Error("transfer failed.")
    }
  },

  pauseEvent(value) {
    Event.Trigger(this.name(), {
      IsPaused: value,
    });
  },

  transferEvent(status, from, to, value) {
    Event.Trigger(this.name(), {
      Status: status,
      Transfer: {
        from: from,
        to: to,
        value: value
      }
    });
  },

  approve(spender, currentValue, value) {
    let from = Blockchain.transaction.from;

    let oldValue = this.allowance(from, spender);
    if (oldValue != currentValue.toString()) {
      throw new Error("current approve value mistake.")
    }

    let balance = new BigNumber(this.balanceOf(from));
    let val = new BigNumber(value);

    if (val.lt(0) || balance.lt(val)) {
      throw new Error("invalid value.")
    }

    let owned = this.allowed.get(from) || new Allowed();
    owned.set(spender, val);

    this.allowed.set(from, owned);

    this.approveEvent(true, from, spender, val);
  },

  approveEvent(status, from, spender, value) {
    Event.Trigger(this.name(), {
      Status: status,
      Approve: {
        owner: from,
        spender: spender,
        value: value
      }
    });
  },

  allowance(owner, spender) {
    let owned = this.allowed.get(owner);

    if (owned instanceof Allowed) {
      let spd = owned.get(spender);
      if (spd instanceof BigNumber) {
        return spd.toString(10)
      }
    }
    return "0"
  }
};

module.exports = ATPToken;
