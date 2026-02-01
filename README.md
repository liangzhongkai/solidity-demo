# solidity-demo

Solidity 智能合约学习和测试案例集合

## 项目结构

```
solidity-demo/
├── contracts/
│   └── examples/              # 所有合约案例
│       ├── 01-slot-packing/   # 案例1: 存储槽打包优化
│       └── 02-new-case/       # 案例2: 新案例（待添加）
├── test/
│   └── examples/              # 对应测试文件
│       ├── 01-slot-packing/
│       └── 02-new-case/
├── scripts/
│   └── examples/              # 演示和部署脚本
│       ├── 01-slot-packing/
│       └── 02-new-case/
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
npm run test:01
```

### 运行演示脚本
```bash
npm run demo:01
npm run visualize:01
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
| `npm run test:01` | 运行特定案例测试 |
| `npm run demo:01` | 运行简单演示脚本 |
| `npm run visualize:01` | 运行详细可视化演示 |
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

### 5. 无需修改 hardhat.config.js
- 已经配置了 `paths.sources` 和 `paths.tests` 指向 `examples` 目录
- 新案例会自动被 Hardhat 识别

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
