'use strict'

// test cases for token.js
// setups for testing contract execution in NVM
import {
  Governance,
  ROLE_EXEC,
  ROLE_CHAIR
} from './governance'

import extend from 'extend'

import native from 'nebulas/lib/nvm/native'

// contract to be tested
import ATPToken from './token'

let block = {
  timestamp: 0,
  height: 1
}

let testSpenderAddr = "n1dAmstUGQ3YB4EVokmRdrvvVCNfJSpender"  // address assigned to chair group
let testOwnerAddr = "n1dAmstUGQ3YB4EVokmRdrvvVCNfJVOwner"     // address assigned to executor group
let testNoAuthdAddr = "n1aiLPgvSR87KFcmSQoEBr4kcDkwVXi1gB3"   // address not assigned neither group

//build up a fake transaction
let transaction = {
  hash: "2933836c3a56ddd789464c7bd3fd92bdb1c974ac62f7b38a34bc48eb33679f52",
  from: testOwnerAddr,
  to: testOwnerAddr,
  value: "0",
  nonce: 1,
  timestamp: 1527077193,
  gasPrice: "1000000",
  gasLimit: "20000"
}

// spender calls
let spenderTransaction = {
  hash: "2933836c3a56ddd789464c7bd3fd92bdb1c974ac62f7b38a34bc48eb33679f53",
  from: testSpenderAddr,
  to: testSpenderAddr,
  value: "0",
  nonce: 1,
  timestamp: 1527077194,
  gasPrice: "1000000",
  gasLimit: "20000"
}

let noAuthTransaction = {
  hash: "2933836c3a56ddd789464c7bd3fd92bdb1c974ac62f7b38a34bc48eb33679f54",
  from: testNoAuthdAddr,
  to: testNoAuthdAddr,
  value: "0",
  nonce: 1,
  timestamp: 1527077195,
  gasPrice: "1000000",
  gasLimit: "20000"
}

let prepareTxEnv = function(block, transaction) {
  extend(native.context.block, block)
  extend(native.context.transaction, transaction)
  Blockchain.blockParse(JSON.stringify(native.context.block))
  Blockchain.transactionParse(JSON.stringify(native.context.transaction))
}

let mintToken = function(token, to, value) {
  // Spender
  prepareTxEnv(block, spenderTransaction)
  // propose mint
  let nonce = token.proposeMinting(to, value)
  // approve mint by one role
  token.approveMinting(nonce)

  // Owner
  prepareTxEnv(block, transaction)
  // approve mint by another role
  token.approveMinting(nonce)
  // submit mint request
  token.submitMinting(nonce)
}

let governanceObj = (function() {
  let addrs = {}
  //setup addresses to two groups
  addrs[testOwnerAddr] = ROLE_CHAIR
  addrs[testSpenderAddr] = ROLE_EXEC
  return {
    _votingAddresses: addrs
  }
})()

let governanceStr = JSON.stringify(governanceObj)

//local storage needs to be cleared before and after each test
beforeEach(() => {
  prepareTxEnv(block, transaction)
  return localStorage.clear()
})

afterEach(() => {
  return localStorage.clear()
})

test('Init contract', () => {
  let token = new ATPToken()

  // deploy: Atlas Protocol, ATP, 18, 10,000,000,000
  token.init('Atlas Protocol', 'ATP', '18', '10000000000', governanceObj)
  expect(token.symbol())
    .toEqual('ATP')
  expect(token.name())
    .toEqual('Atlas Protocol')
  expect(token.decimals())
    .toEqual(18)
  expect(token.totalSupply())
    .toEqual(new BigNumber(10000000000)
      .mul(new BigNumber(10)
        .pow(18))
      .toString(10))

})

test('proposal amount lt 0', () => {
  let token = new ATPToken()
  // deploy: Atlas Protocol, ATP, 18, 10,000,000,000
  token.init('Atlas Protocol', 'ATP', '18', '10000000000', governanceObj)

  // Spender
  prepareTxEnv(block, spenderTransaction)

  // second attempt from spender without enough approval
  expect(function() {
      token.proposeMinting(testOwnerAddr, -1)
    })
    .toThrowError(/^invalid mint amount.$/)

})

test('Mint token need both chair and exec approval', () => {
  let token = new ATPToken()
  // deploy: Atlas Protocol, ATP, 18, 10,000,000,000
  token.init('Atlas Protocol', 'ATP', '18', '10000000000', governanceObj)

  // Spender
  prepareTxEnv(block, spenderTransaction)
  //propose
  let nonce = token.proposeMinting(testOwnerAddr, 100)

  // incorrect current value
  function notEnoughApproval() {
    token.submitMinting(nonce)
  }

  // attempt to submit without any approval
  expect(notEnoughApproval)
    .toThrowError(
      /^unauthorized mint transaction or transaction resubmitted.$/)

  // approve by one role
  token.approveMinting(nonce)

  //Owner
  prepareTxEnv(block, transaction)

  // second attempt from spender without enough approval
  expect(notEnoughApproval)
    .toThrowError(
      /^unauthorized mint transaction or transaction resubmitted.$/)
  // approve by another role
  token.approveMinting(nonce)
  // submit
  expect(function() {
      token.submitMinting(nonce)
    })
    .not.toThrow()

  //submit twice
  expect(function() {
      token.submitMinting(nonce)
    })
    .toThrow(/^unauthorized mint transaction or transaction resubmitted.$/)
})

test('Mint multiple times', () => {
  let token = new ATPToken()
  // deploy: Atlas Protocol, ATP, 18, 10,000,000,000
  token.init('Atlas Protocol', 'ATP', '18', '10000000000', governanceObj)

  // Spender
  prepareTxEnv(block, spenderTransaction)
  //propose
  let nonce = token.proposeMinting(testOwnerAddr, 100)
  // reuse nonce
  expect(function() {token.minter.create(nonce, testOwnerAddr, 100)}).toThrow(/^reused nonce not allowed.$/)

  // approve
  token.approveMinting(nonce)

  //Owner
  prepareTxEnv(block, transaction)
  // approve
  token.approveMinting(nonce)
  // submit
  expect(function() {
      token.submitMinting(nonce)
    })
    .not.toThrow()

  // Spender
  prepareTxEnv(block, spenderTransaction)
  //propose
  nonce = token.proposeMinting(testOwnerAddr, 1100)
  // approve
  token.approveMinting(nonce)

  //Owner
  prepareTxEnv(block, transaction)
  // approve
  token.approveMinting(nonce)
  // submit
  expect(function() {
      token.submitMinting(nonce)
    })
    .not.toThrow()

  // minted twice
  expect(token.balanceOf(testOwnerAddr))
    .toEqual("1200")
  // after two successfully mint proposal the nonce should by increased by 2
  expect(nonce).toEqual(2)
})

test('Get mint transaction values', () => {
  let token = new ATPToken()
  // deploy: Atlas Protocol, ATP, 18, 10,000,000,000
  token.init('Atlas Protocol', 'ATP', '18', '10000000000', governanceObj)

  // Spender
  prepareTxEnv(block, spenderTransaction)
  //propose
  let nonce = token.proposeMinting(testOwnerAddr, 100)
  // approve
  token.approveMinting(nonce)

  //Owner
  prepareTxEnv(block, transaction)
  // approve
  token.approveMinting(nonce)

  //submit twice
  expect((token.getMintTx(nonce))
      .toString())
    .toEqual(
      '{\"_approvalNonce\":1,\"_to":\"n1dAmstUGQ3YB4EVokmRdrvvVCNfJVOwner\",\"_value\":100}' // approver can check what is proposed by calling this method
    )
})

test('Token minting need valid values', () => {
  let token = new ATPToken()
  // deploy: Atlas Protocol, ATP, 18, 10,000,000,000
  token.init('Atlas Protocol', 'ATP', '18', '10000000000', governanceObj)

  // attempt to mint more than remaining supply 
  function notEnoughSupply() {
    return token.proposeMinting(testOwnerAddr,
      10000000001000000000000000000) // 18 decimal
  }
  expect(notEnoughSupply)
    .toThrowError(/^insufficient supply remaining for minting.$/)

  // attempt to mint invalid values
  function invalidMintValue() {
    return token.proposeMinting(testOwnerAddr, NaN)
  }
  expect(invalidMintValue)
    .toThrowError(/^invalid mint amount.$/)

  // attempt to mint negative amount
  function negativeMintValue() {
    return token.proposeMinting(testOwnerAddr, -100)
  }
  expect(negativeMintValue)
    .toThrowError(/^invalid mint amount.$/)

  // submit an invalid mint transaction nonce
  expect(function() {
    token.minter.submit(12345)
  }).toThrow(/^invalid mint transaction nonce/)

  // submit with an invalid pause transaction nonce
  expect(function() {
    token.pause.submit(123456)
  }).toThrow(/^invalid pause transaction nonce/)

})

test('Test allowance and approve', () => {
  let token = new ATPToken()
  token.init('Atlas Protocol', 'ATP', '18', '10000000000', governanceObj)
  // mint token to owner
  expect(token.balanceOf(testOwnerAddr))
    .toEqual("0")
  mintToken(token, testOwnerAddr, 100)
  expect(token.balanceOf(testOwnerAddr))
    .toEqual("100")

  expect(token.allowance(testOwnerAddr, testSpenderAddr))
    .toEqual("0")

  // incorrect current value
  function incorrectApproval() {
    token.approve(testSpenderAddr, 10, 100)
  }
  expect(incorrectApproval)
    .toThrowError(/^current approve value mistake.$/)

  // invalid approval value
  function invalidApproval() {
    token.approve(testSpenderAddr, 0, -100)
  }
  expect(invalidApproval)
    .toThrowError(/^invalid value.$/)

  // correct approval
  token.approve(testSpenderAddr, 0, 100)
  expect(token.allowance(testOwnerAddr, testSpenderAddr))
    .toEqual("100")
})

test('Test transfer', () => {
  let token = new ATPToken()
  token.init('Atlas Protocol', 'ATP', '18', '10000000000', governanceObj)
  // mint token to owner
  mintToken(token, testOwnerAddr, 100)

  // transfer negative value
  function transferNegative() {
    token.transfer(testSpenderAddr, -100)
  }
  expect(transferNegative)
    .toThrowError(/^invalid value.$/)

  // transfer succeed
  expect(function() {
      token.transfer(testSpenderAddr, 100)
    })
    .not.toThrow()
  expect(token.balanceOf(testSpenderAddr))
    .toEqual("100")

  // spender calls
  let spenderTransaction = {
    hash: "2933836c3a56ddd789464c7bd3fd92bdb1c974ac62f7b38a34bc48eb33679f52",
    from: testSpenderAddr,
    to: testSpenderAddr,
    value: "0",
    nonce: 1,
    timestamp: 1527077193,
    gasPrice: "1000000",
    gasLimit: "20000"
  }

  // switch to spender transaction 
  prepareTxEnv(block, spenderTransaction)

  //transfer more than balance
  function transferOverdraw() {
    token.transfer(testOwnerAddr, 200)
  }
  expect(transferOverdraw)
    .toThrowError(/^transfer failed.$/)
})

test('Test transferFrom', () => {
  let token = new ATPToken()
  token.init('Atlas Protocol', 'ATP', '18', '10000000000', governanceObj)
  // mint token to owner
  mintToken(token, testOwnerAddr, 100)

  // no approval fail
  function transferFromWithoutApproval() {
    token.transferFrom(testOwnerAddr, testSpenderAddr, 100)
  }
  expect(transferFromWithoutApproval)
    .toThrowError(/exceeds your allowance$/)

  // approve
  token.approve(testSpenderAddr, 0, 100)

  // switch to spender transaction 
  prepareTxEnv(block, spenderTransaction)

  // with approval overdraw, fail
  function transferFromOverdraw() {
    token.transferFrom(testOwnerAddr, testSpenderAddr, 200)
  }
  expect(transferFromOverdraw)
    .toThrowError(/insufficient balance$/)

  // with approval, transfer 0, fail
  function transferFromValueZero() {
    token.transferFrom(testOwnerAddr, testSpenderAddr, 0)
  }
  expect(transferFromValueZero)
    .not.toThrowError(/^transfer failed.$/)

  // with approval, transfer -1, fail
  function transferFromNegative() {
    token.transferFrom(testOwnerAddr, testSpenderAddr, -1)
  }
  expect(transferFromNegative)
    .toThrowError(/^transfer value must gte 0$/)

  // with approval, success
  expect(token.balanceOf(testOwnerAddr))
    .toEqual("100")
  expect(token.allowance(testSpenderAddr))
    .toEqual("0")
  token.transferFrom(testOwnerAddr, testSpenderAddr, 20)
  expect(token.allowance(testOwnerAddr, testSpenderAddr))
    .toEqual("80")
})

test('Minter serialization', () => {
  let token = new ATPToken()
  token.init('Atlas Protocol', 'ATP', '18', '10000000000', governanceObj)

  expect(token.minter.toString())
    .toEqual('{"_remainingSupply":"1e+28",\"_mintTransactions\":{}}')
})

// test with unauthorized address
test('Test no authorization call', () => {
  let token = new ATPToken()
  token.init('Atlas Protocol', 'ATP', '18', '10000000000', governanceObj)

  prepareTxEnv(block, noAuthTransaction)
  // no auth address
  function invalidMintPropose() {
    return token.proposeMinting(testOwnerAddr, 100)
  }
  //propose
  expect(invalidMintPropose)
    .toThrowError(/^only voting members can propose minting.$/)

  function invalidMintApprove() {
      return token.approveMinting(1)
  }
  //approve
  expect(invalidMintApprove)
      .toThrowError(/^unauthorized account.$/)

  function invalidMintSubmit() {
      return token.submitMinting(1)
  }
  //submit
  expect(invalidMintSubmit)
      .toThrowError(/^unauthorized account.$/)

  // no auth address
  function invalidPausePropose() {
    return token.proposePause(true)
  }
  //propose
  expect(invalidPausePropose)
    .toThrowError(/^only voting members can propose pause.$/)

   //approve
  function invalidPauseApprove() {
      return token.approvePause(1)
  }
  expect(invalidPauseApprove)
      .toThrowError(/^unauthorized account.$/)

  //submit
  function invalidPauseSubmit() {
      return token.submitPause(1)
  }
  expect(invalidPauseSubmit)
      .toThrowError(/^unauthorized account.$/)
})

test('Pause need both chair and exec approval', () => {
  let token = new ATPToken()
  // deploy: Atlas Protocol, ATP, 18, 10,000,000,000
  token.init('Atlas Protocol', 'ATP', '18', '10000000000', governanceObj)

  // Spender
  prepareTxEnv(block, spenderTransaction)
  //propose
  let nonce = token.proposePause(true)

  // incorrect current value
  function notEnoughApproval() {
    token.submitPause(nonce)
  }

  // attempt to submit without any approval
  expect(notEnoughApproval)
    .toThrowError(
      /^unauthorized pause transaction or transaction resubmitted.$/)

  // approve
  token.approvePause(nonce)

  //Owner
  prepareTxEnv(block, transaction)

  // second attempt from spender without enough approval
  expect(notEnoughApproval)
    .toThrowError(
      /^unauthorized pause transaction or transaction resubmitted.$/)
  // approve
  token.approvePause(nonce)
  // submit
  expect(function() {
      token.submitPause(nonce)
    })
    .not.toThrow()

  // current pause status
  expect(token.isPaused())
    .toEqual(true)

  // get proposed pause tx with nonce
  expect((token.getPauseTx(nonce))
      .toString())
    .toEqual('{"_approvalNonce":1,"_value":true}')

  // Spender
  prepareTxEnv(block, spenderTransaction)
  //propose
  nonce = token.proposePause(false)
  // approve
  token.approvePause(nonce)

  //Owner
  prepareTxEnv(block, transaction)
  // approve
  token.approvePause(nonce)
  // submit
  expect(function() {
      token.submitPause(nonce)
    })
    .not.toThrow()

  expect(token.isPaused())
    .toEqual(false)

})

test('Test paused transfer', () => {
  let token = new ATPToken()
  token.init('Atlas Protocol', 'ATP', '18', '10000000000', governanceObj)
  // Spender
  prepareTxEnv(block, spenderTransaction)
  //propose
  let nonce = token.proposePause(true)
  // approve
  token.approvePause(nonce)

  //Owner
  prepareTxEnv(block, transaction)
  // approve
  token.approvePause(nonce)

  // reuse pause nonce
  expect(function(){
    token.pause.create(nonce, true)
  }).toThrow(/^reused nonce not allowed/)

  // submit
  expect(function() {
      token.submitPause(nonce)
    })
    .not.toThrow()

  // mint token to owner
  mintToken(token, testOwnerAddr, 100)

  // transfer negative value
  function transferPaused() {
    token.transfer(testSpenderAddr, 100)
  }
  // function is paused
  expect(transferPaused)
    .toThrowError(/^function suspended.$/)

  // approve
  token.approve(testSpenderAddr, 0, 100)

  // switch to spender transaction
  prepareTxEnv(block, spenderTransaction)

  // transfer with allow
  function transferFromPaused() {
    token.transferFrom(testOwnerAddr, testSpenderAddr, 20)
  }

  // function is paused
  expect(transferFromPaused)
    .toThrowError(/^function suspended.$/)
})

test('Pause invalid', () => {
  let token = new ATPToken()
  token.init('Atlas Protocol', 'ATP', '18', '10000000000', governanceObj)
  // Spender
  prepareTxEnv(block, spenderTransaction)
  // propose invalid pause value
  expect(function() {token.proposePause(123)}).toThrow(/^invalid pause value/)
  
})

test('test version', () => {
  let token = new ATPToken()
  //version
  expect(token.version()).toEqual('1.0.0')
})

// test total supply limits
test('Mint supply exceeds remaining', () => {
  let token = new ATPToken()
  // deploy: Atlas Protocol, ATP, 18, 10,000,000,000
  token.init('Atlas Protocol', 'ATP', '18', '10000000000', governanceObj)

  expect(token.currentSupply()).toEqual("0")

  // Spender
  prepareTxEnv(block, spenderTransaction)
  //propose
  let nonce = token.proposeMinting(testOwnerAddr, 10000000000000000000000000000)

  // approve
  token.approveMinting(nonce)

  //Owner
  prepareTxEnv(block, transaction)
  // approve
  token.approveMinting(nonce)

  // submit
  expect(function() {
      token.submitMinting(nonce)
    })
    .not.toThrow()

  expect(token.balanceOf(testOwnerAddr)).toEqual("10000000000000000000000000000")

  expect(token.currentSupply()).toEqual("10000000000000000000000000000")

  // Spender
  prepareTxEnv(block, spenderTransaction)

  //propose
  expect(function() {
    nonce = token.proposeMinting(testOwnerAddr, 1100)
  }).toThrow(/^insufficient supply remaining for minting/)
})
