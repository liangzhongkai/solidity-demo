ERC20 代币完全指南 - 从零开始

📚 什么是 ERC20？

ERC20 是以太坊上代币的技术标准，就像"模板"一样，确保所有代币都能在钱包、交易所等地方正常工作。

类比: 想象 ERC20 就像钞票的标准：

- 所有钞票都有面额、号码、发行方
- 所有 ERC20 代币都有名称、符号、总量、转账功能

---

🏗️ 核心概念

1. 代币基本信息

string public name = "My Token"; // 代币名称，如 "Bitcoin"
string public symbol = "MTK"; // 代币符号，如 "BTC"
uint8 public decimals = 18; // 小数位数，如 1.5 BTC = 1.5 (8 位小数)
uint256 public totalSupply; // 总供应量，如 2100 万 BTC

重要: decimals = 18 意味着：

- 1 个代币 = 1 × 10^18 = 1000000000000000000 (最小单位)
- 1.5 代币 = 1.5 × 10^18 = 1500000000000000000

2. 余额映射

mapping(address => uint256) private \_balances;
类比: 就像银行账户系统

- 地址 → 余额
- 0x1234...abcd → 1000 × 10^18 (1000 个代币)

3. 授权系统

mapping(address => mapping(address => uint256)) private \_allowances;
类比: 就像信用卡副卡

- 主卡持有者授权副卡可以消费多少钱
- owner 允许 spender 使用 500 个代币

---

🔄 核心业务流程

场景 1: 简单转账 📤

// Alice 想转 100 代币给 Bob
token.transfer(bobAddress, 100 \* 10^18);

流程:

1. 检查 Alice 余额是否 ≥ 100
2. 从 Alice 余额减去 100
3. 给 Bob 余额加上 100
4. 发出 Transfer(Alice, Bob, 100) 事件

现实类比: 银行转账
Alice 账户: 1000 → 900
Bob 账户: 500 → 600

场景 2: 授权机制 🤝

// Alice 授权 Bob 可以使用 200 个她的代币
token.approve(bobAddress, 200 \* 10^18);

流程:

1. 记录 Alice 允许 Bob 使用 200 代币
2. 发出 Approval(Alice, Bob, 200) 事件

现实类比: 给朋友一张信用卡，额度 200 元

场景 3: 授权转账 💳

// Bob 代表 Alice 转账 50 代币给 Charlie
token.transferFrom(aliceAddress, charlieAddress, 50 \* 10^18);

流程:

1. 检查 Alice 是否授权 Bob ≥ 50 代币
2. 从授权额度中减去 50
3. 从 Alice 余额减去 50
4. 给 Charlie 余额加上 50
5. 发出 Transfer(Alice, Charlie, 50) 事件

现实类比: 朋友用你的信用卡给别人买东西

---

🎯 完整业务场景

场景: DeFi 质押平台

// 1. 用户先授权平台使用自己的代币
await token.approve(platformAddress, 1000 \* 10^18);

// 2. 平台为用户质押代币
await platform.stake(1000 _ 10^18);
// 内部调用: token.transferFrom(user, platform, 1000 _ 10^18)

// 3. 平台发放奖励
await platform.withdrawReward(userAddress);
// 内部调用: token.transfer(user, 100 \* 10^18)

---

📊 数据流动图

┌─────────────────────────────────────────────────────────┐
│ ERC20 代币系统 │
└─────────────────────────────────────────────────────────┘

初始状态:
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Alice │ │ Bob │ │ Charlie │
│ 1000 TKN │ │ 500 TKN │ │ 200 TKN │
└──────────┘ └──────────┘ └──────────┘

步骤 1: Alice 转账 300 TKN 给 Bob
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Alice │────────││ Bob │ │ Charlie │
│ 700 TKN │ 300 │ 800 TKN │ │ 200 TKN │
└──────────┘ └──────────┘ └──────────┘

步骤 2: Alice 授权 Bob 使用 200 TKN
┌─────────────────────────────────────────────────────┐
│ Allowance[Alice][Bob] = 200 TKN │
└─────────────────────────────────────────────────────┘

步骤 3: Bob 代表 Alice 转账 150 TKN 给 Charlie
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Alice │ │ Bob │─────────││ Charlie │
│ 550 TKN │ │ 800 TKN │ 150 │ 350 TKN │
└──────────┘ └──────────┘ └──────────┘

┌─────────────────────────────────────────────────────┐
│ Allowance[Alice][Bob] = 50 TKN (200-150) │
└─────────────────────────────────────────────────────┘

---

🔐 安全机制

1. 余额检查

uint256 fromBalance = \_balances[from];
if (fromBalance < amount) {
revert InsufficientBalance(from, amount, fromBalance);
}
防止: 转账超过余额

2. 授权检查

uint256 currentAllowance = \_allowances[from][msg.sender];
if (currentAllowance < amount) {
revert InsufficientAllowance(from, msg.sender, amount, currentAllowance);
}
防止: 超过授权额度

3. 零地址保护

if (to == address(0)) revert InvalidRecipient(to);
防止: 代币丢失到零地址

---

💡 常见使用场景

1. ICO (首次代币发行)

// 项目方部署代币合约
const token = await deployToken("MyProject", "MPR", 18, 1000000);

// 投资者发送 ETH，获得代币
await token.transfer(investor, 1000 \* 10^18);

2. 空投

// 批量转账给多个地址
for (let recipient of recipients) {
await token.transfer(recipient, 100 \* 10^18);
}

3. DeFi 质押

// 用户授权 DeFi 平台
await token.approve(defiPlatform, 1000 \* 10^18);

// DeFi 平台提取用户代币
await defiPlatform.stake(1000 \* 10^18);

4. 交易对流动性

// Uniswap 等需要授权
await token.approve(uniswapRouter, amount);

// 添加流动性
await uniswapRouter.addLiquidity(token, usdt, amount1, amount2);

---

🎓 关键要点总结

1. ERC20 = 代币标准: 确保所有代币行为一致
2. 余额系统: 每个地址有自己的代币余额
3. 授权机制: 允许第三方代表你操作代币
4. 事件系统: 所有关键操作都会发出事件，便于追踪
5. 安全第一: 各种检查防止错误操作

记住: ERC20 代币就像数字货币，但运行在智能合约上，可以编程控制！
