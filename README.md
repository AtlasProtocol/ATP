#支持ATP协议的智能合约
------
ATP协议主要是通过撮合协议，将广告主发布的广告和推广者发布的需求进行匹配，将符合要求的广告推送给推广者，推广者收集每天用户的点击事件，经过反作弊算法过滤后的数据上报区块链，完成广广告费的自动结算。

ATP协议共包含三部分智能合约：
####1、ATC Token智能合约
ATC需满足：
#####1）ERC20 Token标准，函数为：
> * balanceOf：查询余额。
> * transfer：转账。
> * transferEvent：转账事件。
#####2）符合ATP扣款协议，函数为：
> * _transferATP：内部调用函数，根据广告ID，只有匹配上的推广者上报的点击事件才能完成自动结算，从广告主账户自动划拨ATCToken至点击者和推广者账户。

####2、广告和广告需求发布合约
> * publishAd：发布广告，需要选择撮合协议ID —— matchRuleId。
> * viewAd：查看某个撮合协议中的所有广告。
> * publishAdDemand：发布广告需求，需要选择撮合协议ID —— matchRuleId。
> * viewAdDemand：查看某个撮合协议中的所有广告需求。

####3、撮合协议
撮合协议包含返回匹配结果和点击事件上报的自动结算，本例中的撮合协议的ID为1，实际应用中可以有多个撮合协议。
> * matchDeal：根据广告推广者的address，返回匹配的广告。
> * checkMatched：供ATC Token智能合约调用。
> * userClickedAd：推广者上报的用户点击事件，可以将一天的信息打包同时上报，并完成广告费的自动结算，本例中只给出了每次的点击事件上链的函数。
