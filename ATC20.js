// Copyright (C) 2017 go-nebulas authors
//
// This file is part of the go-nebulas library.
//
// the go-nebulas library is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// the go-nebulas library is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with the go-nebulas library.  If not, see <http://www.gnu.org/licenses/>.
//

'use strict';

var Ads = function (obj) {
    this.ads = [];
    this.parse(obj);
};

Ads.prototype = {
    toString: function () {
        return JSON.stringify(this.ads);
    },
    parse: function (obj) {
        if ( typeof obj != "undefined" ) {
            var data = JSON.parse(obj);
            for (var o in data) {
                var ad = new Ad(JSON.stringify(data[o]["ad"]));
                this.ads.push(ad);
            }
        }
    },

    add: function(value) {
        this.ads.push(value);
    }
};


var Ad = function (obj) {
    this.ad = {};
    this.parse(obj);
};

Ad.prototype = {
    toString: function () {
        return JSON.stringify(this.ad);
    },

    parse: function (obj) {
        if ( typeof obj != "undefined" ) {
            var data = JSON.parse(obj);
            for (var key in data) {
                this.ad[key] = data[key];
            }
        }
    },

    get: function (key) {
        return this.ad[key];
    },

    set: function (key, value) {
        this.ad[key] = value;
    }
};

var AdDemands = function (obj) {
    this.adDemands = [];
    this.parse(obj);
};

AdDemands.prototype = {
    toString: function () {
        return JSON.stringify(this.adDemands);
    },
    parse: function (obj) {
        if ( typeof obj != "undefined" ) {
            var data = JSON.parse(obj);
            for (var o in data) {
                var adDemand = new AdDemand(JSON.stringify(data[o]["adDemand"]));
                this.adDemands.push(adDemand);
            }
        }
    },

    add: function(value) {
        this.adDemands.push(value);
    }
};

var AdDemand = function (obj) {
    this.adDemand = {};
    this.parse(obj);
};

AdDemand.prototype = {
    toString: function () {
        return JSON.stringify(this.adDemand);
    },

    parse: function (obj) {
        if ( typeof obj != "undefined" ) {
            var data = JSON.parse(obj);
            for (var key in data) {
                this.adDemand[key] = data[key];
            }
        }
    },

    get: function (key) {
        return this.adDemand[key];
    },

    set: function (key, value) {
        this.adDemand[key] = value;
    }
};

var ATCContract = function () {
    LocalContractStorage.defineProperties(this, {
        _name: null,
        _symbol: null,
        _decimals: null,
        _owner: null,
        _totalSupply: {
            parse: function (value) {
                return new BigNumber(value);
            },
            stringify: function (o) {
                return o.toString(10);
            }
        }
    });

    LocalContractStorage.defineMapProperties(this, {
        "balances": {
            parse: function (value) {
                return new BigNumber(value);
            },
            stringify: function (o) {
                return o.toString(10);
            }
        },
        "ads": {
            parse: function (value) {
                return new Ads(value);
            },
            stringify: function (o) {
                return o.toString();
            }
        },
        "adDemands": {
            parse: function (value) {
                return new AdDemands(value);
            },
            stringify: function (o) {
                return o.toString();
            }
        }
    });
};

ATCContract.prototype = {
    init: function (name, symbol, decimals, totalSupply) {
        this._name = name;
        this._symbol = symbol;
        this._decimals = decimals | 0;
        this._totalSupply = new BigNumber(totalSupply).mul(new BigNumber(10).pow(decimals));

        var from = Blockchain.transaction.from;
        this._owner = from;
        this.balances.set(from, this._totalSupply);
    },

    // Returns the name of the token
    name: function () {
        return this._name;
    },

    // Returns the symbol of the token
    symbol: function () {
        return this._symbol;
    },

    // Returns the number of decimals the token uses
    decimals: function () {
        return this._decimals;
    },
    
    owner: function () {
        return this._owner;
    },

    totalSupply: function () {
        return this._totalSupply.toString(10);
    },

    balanceOf: function (owner) {
        var balance = this.balances.get(owner);

        if (balance instanceof BigNumber) {
            return balance.toString(10);
        } else {
            return "0";
        }
    },

    transfer: function (to, value) {
        value = new BigNumber(value);

        var from = Blockchain.transaction.from;
        var balance = this.balances.get(from) || new BigNumber(0);

        if (balance.lt(value)) {
            this.transferEvent(false, from, to, value);
            return false;
        }

        this.balances.set(from, balance.sub(value));
        var toBalance = this.balances.get(to) || new BigNumber(0);
        this.balances.set(to, toBalance.add(value));

        this.transferEvent(true, from, to, value);
        return true;
    },
    
    // This function transfer the ATC token from the advertiser to the publisher
    _transferATP: function(from, to, publisherAddr, value, adId) {
        if(this.checkMatched(from, adId, publisherAddr) == true) { //Only the matching publisher can 
            var balance = this.balances.get(from) || new BigNumber(0);

            if (balance.gte(value)) {

                this.balances.set(from, balance.sub(value));

                var toBalance = this.balances.get(to) || new BigNumber(0);
                this.balances.set(to, toBalance.add(value));

                this.transferEvent(true, from, to, value);
                return true;
            } else {
                this.transferEvent(false, from, to, value);
                return false;
            }
        }
    },

    transferEvent: function(result, from, to, value) {
        Event.Trigger(this.name(), {
            Status: result,
            Transfer: {
                from: from,
                to: to,
                value: value
            }
        });
    },
    
    /* This preAllocToken function is only for demo, not for production purpose.
    In production environment, advertiser should buy the ATC token. */
    _preAllocToken: function (to, value) {
        value = new BigNumber(value);

        var from = this._owner;
        var balance = this.balances.get(from) || new BigNumber(0);

        if (balance.lt(value)) {
            this.transferEvent(false, from, to, value);
            return false;
        }

        this.balances.set(from, balance.sub(value));
        var toBalance = this.balances.get(to) || new BigNumber(0);
        this.balances.set(to, toBalance.add(value));

        this.transferEvent(true, from, to, value);
        return true;
    },

    publishAd: function(desc, id, price, budget, matchRuleId) {
        var from = Blockchain.transaction.from;
        
        // Temporarily give the ad provider the token (=budget)
        this._preAllocToken(from, budget);
        
        var ads = this.ads.get(matchRuleId) || new Ads();
        var ad = new Ad();
        ad.ad["desc"] = desc;
        ad.ad["id"] = id;
        ad.ad["price"] = price;
        ad.ad["budget"] = budget;
        ad.ad["from"] = from;
        ad.ad["matchRuleId"] = matchRuleId;
        ad.ad["status"] = 0; // 0:pending 1:ongoing 2:finish
        ads.add(ad);
        this.ads.set(matchRuleId, ads);
    },
    
    viewAd: function(matchRuleId) {
        var ads = this.ads.get(matchRuleId);
        if (!ads) {
            return "";
        }
        return ads.toString();
    },
    
    publishAdDemand: function(desc, matchRuleId) {
        var from = Blockchain.transaction.from;
        var adDemands = this.adDemands.get(matchRuleId) || new AdDemands();
        var adDemand = new AdDemand();
        adDemand.adDemand["desc"] = desc;
        adDemand.adDemand["matchRuleId"] = matchRuleId;
        adDemand.adDemand["from"] = from;
        adDemands.add(adDemand);
        this.adDemands.set(matchRuleId, adDemands);        
    },
    
    viewAdDemand: function(matchRuleId) {
        var adDemands = this.adDemands.get(matchRuleId);
        if (!adDemands) {
            return "";
        }
        return adDemands.toString();
    },

    /* This function simulates the matching rule with Id = 1.
    The matching rule returns all the advertisements with the same "desc" string to the ad demand. */
    matchDeal: function(pulisherAddr) {
        var matchRuleId = 1;
        var adDemands = this.adDemands.get(matchRuleId);
        if (!adDemands) {
            return "";
        }
        
        var qualifiedAds = new Ads();
        
        for(var i in adDemands.adDemands) {
            if(adDemands.adDemands[i].adDemand["from"] == pulisherAddr) {
                var desc = adDemands.adDemands[i].adDemand["desc"];
                var ads = this.ads.get(matchRuleId);
                if(!ads) {
                    continue;
                }
                for(var j in ads.ads) {
                    if(ads.ads[j].ad["desc"] == desc) { //Matching Rule: the desc should be the same
                        qualifiedAds.add(ads.ads[j]);
                    }
                }
            }
        }
        return qualifiedAds.toString();
    },
    
    checkMatched: function(advertiserAddr, adId, publisherAddr) {
        var matchRuleId = 1;
        var qualifiedAds = this.matchDeal(publisherAddr);
        if(qualifiedAds == "") {
            return false;
        }
        var data = JSON.parse(qualifiedAds);
        for (var i in data) {
            var ad = data[i]["ad"];
            if((ad["id"] == adId) && (ad["from"] == advertiserAddr)) {
                return true;
            }
        }
        return false;
    },

    /* this function is provided by the match rule provider together. */
    userClickedAd: function(clickerAddr, id){
        var matchRuleId = 1;
        //TODO: check fraud

        //Transfer the ATC token to user and publisher
        var publisherAddr = Blockchain.transaction.from;
        var qualifiedAds = this.matchDeal(publisherAddr);
        if(qualifiedAds == "") {
            return false;
        }
        var data = JSON.parse(qualifiedAds);
        for (var i in data) {
            var ad = data[i]["ad"];
            if(ad["id"] == id) {
                var from = ad["from"];
                var price = ad["price"];
            }
        }
        
        if (typeof from != "undefined") {
            this._transferATP(from, clickerAddr, publisherAddr, price, id);
            this._transferATP(from, publisherAddr, publisherAddr, price, id);
        }
    }

};

module.exports = ATCContract;
