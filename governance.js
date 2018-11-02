'use strict';

/**
 * An implementation of multiple signing mechanism was introduced in this file
 * as the following steps:
 * 1. Accounts are assigned into two groups, chairman and executor;
 * 2. Proposal is made by an arbitrary account from either group;
 * 3. The proposal needs at least one approval from each group to become valid;
 * Developers can import this file into their smart contact as long as there
 * is a multiple signing requirement.
 **/

import { extendsSerializable } from './utils'

// Two groups: Chair & Executive
const ROLE_CHAIR = 'chair'
const ROLE_EXEC = 'exec'

let Governance = function(obj) {
  this._txNonce = 0  // Index of the proposals, always growing by one after the contract is deployed.
  this._completedTxs = {} // Proposal marked as completed after submitted to avoid duplicated submission.
  this._votingAddresses = {} // All the addresses assigned to chair or exec. It is set during the deployment of contract and cannot by changed afterwards.
  this._txChairApprovals = {} // Proposal is approved or disapproved by a chairman.
  this._txExecApprovals = {} // Proposal is approved or disapproved by an executor.

  this.parseObj(obj)
}

// parse the string to object
let GovernanceProto = {
  _parseObj(data) {
    if (data.hasOwnProperty('_votingAddresses')) {
      let vAddrs = data['_votingAddresses']
      for (let addr in vAddrs) {
        if (vAddrs[addr] === ROLE_CHAIR ||
            vAddrs[addr] === ROLE_EXEC) {
          this._votingAddresses[addr] = vAddrs[addr]
        }
      }
    }
    if (data.hasOwnProperty('_txNonce')) {
      this._txNonce = data['_txNonce']
    }
    if (data.hasOwnProperty('_completedTxs')) {
      let cTxs = data['_completedTxs']
      for (let tx in cTxs) {
        this._completedTxs[tx] = cTxs[tx]
      }
    }
    if (data.hasOwnProperty('_txChairApprovals')) {
      let cApprs = data['_txChairApprovals']
      for (let tx in cApprs) {
        this._txChairApprovals[tx] = cApprs[tx]
      }
    }
    if (data.hasOwnProperty('_txExecApprovals')) {
      let eApprs = data['_txExecApprovals']
      for (let tx in eApprs) {
        this._txExecApprovals[tx] = eApprs[tx]
      }
    }
  },
  // Return true if the address represent a board chair
  _isChair(addr) {
    return this._votingAddresses[addr] &&
      this._votingAddresses[addr] === ROLE_CHAIR
  },
  // Return true if the address represents an executive
  _isExec(addr) {
    return this._votingAddresses[addr] &&
      this._votingAddresses[addr] === ROLE_EXEC
  },
  // return the transaction nonce, increase by one after a valid proposal
  propose(addr) {
    if (this.isAuthorized(addr)) {
      return ++this._txNonce
    }
    return 0
  },
  // check if the address belong to the voting address set
  isAuthorized(addr){
    return this._votingAddresses.hasOwnProperty(addr)
  },
  // approve a proposal by index
  approve(addr, txNonce) {
    if (this._isChair(addr)) {
      this._txChairApprovals[txNonce] = true
    } else if (this._isExec(addr)) {
      this._txExecApprovals[txNonce] = true
    }
  },
  // check if the proposal is approved by account from each group
  approved(txNonce) {
    return !! (this._txExecApprovals[txNonce] && this._txChairApprovals[txNonce])
  },
  // mark the proposal as completed
  submit(txNonce) {
    if (this.approved(txNonce) && !this._completedTxs[txNonce]) {
      return this._completedTxs[txNonce] = true
    }
    return false
  }
}

Governance.prototype = extendsSerializable(GovernanceProto)

export {
  Governance,
  ROLE_EXEC,
  ROLE_CHAIR
}
