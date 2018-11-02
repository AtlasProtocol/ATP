'use strict'

// Parse and toString method used in the serialization of complex object.
// They will be called implicitly during object saving and retrieving from persistent storage.
let Serializable = {
  parseObj(obj) {
    if (Object.prototype.toString.call(obj) === '[object String]') {
      this._parseObj(JSON.parse(obj))
    } else if (Object.prototype.toString.call(obj) === '[object Object]') {
      this._parseObj(obj)
    }
  },

  toString() {
    return JSON.stringify(this)
  }
}

export function extendsSerializable (protoObj) {
  protoObj.__proto__ = Serializable
  return protoObj
}
