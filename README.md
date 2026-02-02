# solidity-demo

Solidity 智能合约学习和测试案例集合

## 项目结构

```
solidity-demo/
├── contracts/
│   └── examples/              # 所有合约案例
│       ├── 01-slot-packing/   # 案例1: 存储槽打包优化
│       └── 02-erc20/          # 案例2: 生产级ERC20代币
├── test/
│   └── examples/              # 对应测试文件
│       ├── 01-slot-packing/
│       └── 02-erc20/
├── scripts/
│   └── examples/              # 演示和部署脚本
│       ├── 01-slot-packing/
│       └── 02-erc20/
├── artifacts/                 # 编译产物（自动生成，已在.gitignore）
├── cache/                     # 编译缓存（自动生成，已在.gitignore）
├── node_modules/              # 依赖包（已在.gitignore）
├── hardhat.config.js          # Hardhat配置文件
├── package.json               # 项目依赖和脚本命令
└── .gitignore                 # Git忽略文件配置
```

### 目录说明

- **contracts/examples/**: Solidity 合约源码，每个案例独立目录
- **test/examples/**: 对应的测试文件，使用 Hardhat Test 框架
- **scripts/examples/**: 演示脚本和部署工具
- **artifacts/**: Hardhat 编译后的合约 ABI 和 bytecode（不提交）
- **cache/**: Hardhat 编译缓存（不提交）

## 快速开始

### 安装依赖
```bash
npm install
```

### 编译所有合约
```bash
npm run compile
```

### 测试所有案例
```bash
npm test
```

### 测试特定案例
```bash
npm run test:01    # 测试存储槽打包
npm run test:02    # 测试ERC20代币
```

### 运行演示脚本
```bash
npm run demo:01        # 运行存储槽打包演示
npm run visualize:01    # 运行存储槽可视化
npm run demo:02         # 运行ERC20代币部署演示
```

### 启动本地节点
```bash
npm start
# 或
npx hardhat node
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm install` | 安装项目依赖 |
| `npm run compile` | 编译所有合约 |
| `npm test` | 运行所有测试 |
| `npm run test:01` | 运行存储槽打包测试 |
| `npm run test:02` | 运行ERC20代币测试 |
| `npm run demo:01` | 运行存储槽打包演示 |
| `npm run visualize:01` | 运行存储槽可视化 |
| `npm run demo:02` | 运行ERC20代币部署演示 |
| `npm start` | 启动 Hardhat 本地节点 |

## 添加新案例

### 1. 创建目录结构
```bash
mkdir -p contracts/examples/02-new-case
mkdir -p test/examples/02-new-case
mkdir -p scripts/examples/02-new-case  # 可选
```

### 2. 创建合约文件
```solidity
// contracts/examples/02-new-case/NewContract.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract NewContract {
    // 你的合约代码
}
```

### 3. 创建测试文件
```javascript
// test/examples/02-new-case/NewContract.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NewContract", function () {
  it("应该测试合约功能", async function () {
    const NewContract = await ethers.getContractFactory("NewContract");
    const contract = await NewContract.deploy();

    // 测试代码
  });
});
```

### 4. 在 package.json 添加命令
```json
{
  "scripts": {
    "test:02": "hardhat test test/examples/02-new-case/NewContract.test.js",
    "demo:02": "node scripts/examples/02-new-case/demo.js"
  }
}
```

## 案例说明

### 01-slot-packing - 存储槽打包优化
演示 Solidity 变量存储优化，通过合理安排变量顺序减少 Gas 消耗：
- **PackingChallenge.sol** - 非优化的变量顺序
- **PackingChallengeOptimized.sol** - 优化的变量顺序
- **测试**: 对比两种版本的存储槽使用情况
- **演示**: 可视化展示 Gas 节省效果

### 02-erc20 - 生产级ERC20代币
完整的 ERC20 代币实现，符合生产环境标准：
- **ProductionERC20.sol** - 生产级ERC20合约
- **核心功能**: transfer、transferFrom、approve、allowance、balanceOf、totalSupply
- **工程标准**: custom errors、indexed events、unchecked优化、内部函数复用
- **配置化**: 支持自定义name、symbol、decimals等参数
- **测试**: 全面的单元测试覆盖
- **演示**: 完整的部署和交易流程演示

## ProductionERC20.sol 代码详解

### 合约结构

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ProductionERC20 {
    // 自定义错误 - 比require字符串更省gas
    error InsufficientBalance(address account, uint256 required, uint256 available);
    error InsufficientAllowance(address owner, address spender, uint256 required, uint256 available);
    error InvalidRecipient(address recipient);
    // ... 其他错误定义
```

### 1. Custom Errors（自定义错误）
使用自定义错误而不是传统的`require`字符串，节省大量gas：

```solidity
// 传统方式 (gas开销大)
require(_balances[from] >= amount, "Insufficient balance");

// 生产级方式 (gas优化)
if (_balances[from] < amount) {
    revert InsufficientBalance(from, amount, _balances[from]);
}
```

### 2. 状态变量设计
```solidity
string public name;                    // 代币名称
string public symbol;                  // 代币符号
uint8 public immutable decimals;       // 小数位数 (不可变)
uint256 public totalSupply;            // 总供应量

mapping(address => uint256) private _balances;                    // 余额映射
mapping(address => mapping(address => uint256)) private _allowances; // 授权映射
```

### 3. Events（事件）
使用`indexed`参数，便于前端监听和过滤：

```solidity
event Transfer(address indexed from, address indexed to, uint256 value);
event Approval(address indexed owner, address indexed spender, uint256 value);
```

### 4. 构造函数（可配置参数）
```solidity
constructor(
    string memory _name,
    string memory _symbol,
    uint8 _decimals,           // 不硬编码，支持任意小数位
    uint256 initialSupply,
    address initialOwner
) {
    name = _name;
    symbol = _symbol;
    decimals = _decimals;      // immutable变量，部署后不可修改
    _mint(initialOwner, initialSupply);
}
```

### 5. 核心功能实现

#### Transfer（转账）
```solidity
function transfer(address to, uint256 amount) external returns (bool) {
    if (to == address(0)) revert InvalidRecipient(to);
    _transfer(msg.sender, to, amount);  // 复用内部函数
    return true;
}
```

#### Approve（授权）
```solidity
function approve(address spender, uint256 amount) external returns (bool) {
    if (spender == address(0)) revert ApprovalToZeroAddress();
    _approve(msg.sender, spender, amount);  // 复用内部函数
    return true;
}
```

#### TransferFrom（授权转账）
```solidity
function transferFrom(address from, address to, uint256 amount) external returns (bool) {
    uint256 currentAllowance = _allowances[from][msg.sender];
    if (currentAllowance < amount) {
        revert InsufficientAllowance(from, msg.sender, amount, currentAllowance);
    }

    unchecked {
        // unchecked优化：已检查allowance >= amount，减法不会下溢
        _approve(from, msg.sender, currentAllowance - amount);
    }

    _transfer(from, to, amount);
    return true;
}
```

### 6. Gas优化技巧

#### Unchecked块
```solidity
unchecked {
    _balances[from] = fromBalance - amount;  // 安全：已检查fromBalance >= amount
    _balances[to] += amount;                 // 安全：加法不会溢出（Solidity 0.8+）
}
```

#### 内部函数复用
```solidity
function _transfer(address from, address to, uint256 amount) internal {
    // 统一的转账逻辑，避免代码重复
    uint256 fromBalance = _balances[from];
    if (fromBalance < amount) {
        revert InsufficientBalance(from, amount, fromBalance);
    }

    unchecked {
        _balances[from] = fromBalance - amount;
        _balances[to] += amount;
    }

    emit Transfer(from, to, amount);
}
```

### 7. 安全特性

- **零地址检查**: 防止向零地址转账或授权
- **溢出检查**: Solidity 0.8+ 内置溢出检查
- **自定义错误**: 提供详细的错误信息，节省gas
- **事件记录**: 所有关键操作都发出事件

### 8. 扩展功能

```solidity
// 增加授权额度
function increaseAllowance(address spender, uint256 addedValue) external returns (bool) {
    uint256 currentAllowance = _allowances[msg.sender][spender];
    _approve(msg.sender, spender, currentAllowance + addedValue);
    return true;
}

// 减少授权额度
function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool) {
    uint256 currentAllowance = _allowances[msg.sender][spender];
    if (currentAllowance < subtractedValue) {
        revert InsufficientAllowance(msg.sender, spender, subtractedValue, currentAllowance);
    }

    unchecked {
        _approve(msg.sender, spender, currentAllowance - subtractedValue);
    }
    return true;
}
```

### 使用示例

```solidity
// 部署合约
ProductionERC20 token = new ProductionERC20(
    "My Token",           // name
    "MTK",                // symbol
    18,                   // decimals
    1000000 * 10**18,    // initialSupply
    msg.sender            // initialOwner
);

// 转账
token.transfer(addr1, 100 * 10**18);

// 授权
token.approve(addr2, 50 * 10**18);

// 授权转账
token.transferFrom(msg.sender, addr1, 30 * 10**18);
```

## 开发说明

### 自动生成的目录
- `artifacts/` - 编译后的合约 ABI 和 bytecode
- `cache/` - Hardhat 编译缓存
- 这些目录已加入 `.gitignore`，不会提交到仓库

### 命令命名规范
- `test:XX` - 测试命令
- `demo:XX` - 简单演示脚本
- `visualize:XX` - 详细可视化演示

## 案例说明

### 01-slot-packing - 存储槽打包优化
演示 Solidity 变量存储优化，通过合理安排变量顺序减少 Gas 消耗：
- **PackingChallenge.sol** - 非优化的变量顺序
- **PackingChallengeOptimized.sol** - 优化的变量顺序
- **测试**: 对比两种版本的存储槽使用情况
- **演示**: 可视化展示 Gas 节省效果

## 许可证
MIT
