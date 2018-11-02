'use strict';
// test cases for governance.js
import {
  Governance,
  ROLE_EXEC,
  ROLE_CHAIR
} from './governance'

import native from 'nebulas/lib/nvm/native'

let testGoveners = function() {
  let addrs = {}
  // assigned address to chair and executor group
  addrs['addr1'] = ROLE_CHAIR
  addrs['addr2'] = ROLE_CHAIR
  addrs['addr3'] = ROLE_EXEC
  addrs['addr4'] = ROLE_EXEC
  addrs['addr5'] = 'INVALID'
  return JSON.stringify({
    _txNonce: 0,
    _votingAddresses: addrs
  })
}()

// need to clear local storage before and after each test to avoid data mess up
beforeEach(() => {
  return localStorage.clear()
})

afterEach(() => {
  return localStorage.clear()
})

test('Init Governance', () => {
  let g1 = new Governance()
  expect(g1.toString()).toEqual('{\"_txNonce\":0,\"_completedTxs\":{},\"_votingAddresses\":{},\"_txChairApprovals\":{},\"_txExecApprovals\":{}}')

  let g2 = new Governance(testGoveners)
  expect(g2._txNonce)
    .toBe(0)
  expect(g2._completedTxs)
    .toEqual({})
  expect(g2._txChairApprovals).toEqual({})
  expect(g2._txExecApprovals).toEqual({})

  let data = {
    _txChairApprovals: {
      "1": true,
      "2": true,
      "3": true
    },
    _txExecApprovals: {
      "1": true,
      "2": true,
      "3": true
    }
  }
  let g3 = new Governance(data)
  expect(g3.toString())
    .toEqual('{\"_txNonce\":0,\"_completedTxs\":{},\"_votingAddresses\":{},\"_txChairApprovals\":{\"1\":true,\"2\":true,\"3\":true},\"_txExecApprovals\":{\"1\":true,\"2\":true,\"3\":true}}') // this is desired string format to setup governance object


  g3.parseObj({_completedTxs: {"1": true, "2": true, "3": true}})
  expect(g3._completedTxs).toEqual({"1": true, "2": true, "3": true})
})

test('Increase txNonce after proposal', () => {
  let g = new Governance(testGoveners)

  expect(g._txNonce)
    .toBe(0)
  let nonce = g.propose('addr1')
  expect(nonce)
    .toBe(1)
  expect(g._txNonce)
    .toBe(1) // txNonce should increase by one after a successful propose

  // only voting addresses can propose
  expect(g.propose('INVALID'))
    .toBe(0)
})

test('New proposal are not approved', () => {
  let g = new Governance(testGoveners)

  let nonce = g.propose('addr1')
  expect(nonce)
    .toBe(1)
  // need approved by both roles
  expect(g.approved(nonce))
    .toBe(false)
})

test('New propsal need to be apprved by both roles', () => {
  let g = new Governance(testGoveners)

  // only approved by chair
  let nonce = g.propose('addr1')
  expect(nonce)
    .toBe(1)
  g.approve('addr1', nonce)
  expect(g.approved(nonce))
    .toBe(false)
  g.approve('addr2', nonce)
  expect(g.approved(nonce))
    .toBe(false)

  // only approved by exec
  nonce = g.propose('addr1')
  expect(nonce)
    .toBe(2)
  g.approve('addr3', nonce)
  expect(g.approved(nonce))
    .toBe(false)
  g.approve('addr4', nonce)
  expect(g.approved(nonce))
    .toBe(false)

  // approved by both roles
  nonce = g.propose('addr1')
  expect(nonce)
    .toBe(3)
  g.approve('addr2', nonce)
  expect(g.approved(nonce))
    .toBe(false)
  g.approve('addr3', nonce)
  expect(g.approved(nonce))
    .toBe(true)
})

test('Approved proposal can only be submitted once', () => {
  let g = new Governance(testGoveners)

  let nonce = g.propose('addr1')
  expect(nonce)
    .toBe(1)
  g.approve('addr2', nonce)
  expect(g.approved(nonce))
    .toBe(false)
  expect(g.submit(nonce))
    .toBe(false)
  g.approve('addr3', nonce)
  expect(g.approved(nonce))
    .toBe(true)

  expect(g.submit(nonce))
    .toBe(true)
  expect(g.submit(nonce))
    .toBe(false) // duplicated submit would be failed

  expect(g.toString())
    .toEqual(
      '{\"_txNonce\":1,\"_completedTxs\":{\"1\":true},\"_votingAddresses\":{\"addr1\":\"chair\",\"addr2\":\"chair\",\"addr3\":\"exec\",\"addr4\":\"exec\"},\"_txChairApprovals\":{\"1\":true},\"_txExecApprovals\":{\"1\":true}}'
    )
})

test('Governance serialization', () => {
  let g = new Governance(testGoveners)
  expect(g.toString())
    .toEqual(
      '{\"_txNonce\":0,\"_completedTxs\":{},\"_votingAddresses\":{\"addr1\":\"chair\",\"addr2\":\"chair\",\"addr3\":\"exec\",\"addr4\":\"exec\"},\"_txChairApprovals\":{},\"_txExecApprovals\":{}}'
    )
})
