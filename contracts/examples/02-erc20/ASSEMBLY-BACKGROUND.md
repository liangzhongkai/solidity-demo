# _transferOptimized 背景知识 + 逐行详解

本文先讲清「EVM 存储、汇编、事件」等背景，再逐行解释 `_transferOptimized` 在做什么。

---

## 一、背景知识

### 1. EVM 的「存储」长什么样？

合约的**状态变量**（如 `_balances`）存在 EVM 的**存储（Storage）**里：

- 存储是一张**巨大的键值表**：每个「键」是一个 32 字节的槽位编号（slot），每个「值」是 32 字节。
- 你可以把 slot 想成「柜子编号」，每个柜子里放一个 32 字节的数。

```
Slot 0    → name（string 的 length 等）
Slot 1    → symbol（string 的 length 等）
Slot 2    → totalSupply（uint256）
Slot 3    → _balances 的「编号」（mapping 不在此存数据，只用于 keccak256(key, 3) 算实际槽位）
Slot 4    → _allowances 的「编号」
...
Slot k    → _balances[某地址] 等（k = keccak256(addr, 3) 等）
```

所以：**要读/写某个状态，本质就是「算出它对应的 slot 编号，然后 sload/sstore 那个 slot」**。

---

### 2. Solidity 里普通变量和 mapping 的 slot 怎么算？

- **普通变量**（如 `uint256 totalSupply`）：按声明顺序依次占 slot 0, 1, 2, …  
  **本合约精确布局**：`name` 占 slot 0，`symbol` 占 slot 1；`decimals` 是 **immutable** 不占存储；`totalSupply` 占 **slot 2**；`_balances` 这个 mapping 的「编号」是 **slot 3**（即 `BALANCES_SLOT = 3`）；`_allowances` 占 slot 4。  
  所以 **totalSupply 在 slot 2，BALANCES_SLOT 是 slot 3**，二者不是同一个槽位。

- **mapping(key → value)** 的规则是：
  - mapping 自己只占 1 个 slot（存的是「这个 mapping 的编号」，不存具体 key 的值）。
  - **某个 key 对应的 value 存在哪个 slot？**  
    公式是：
    ```text
    slot(key) = keccak256( abi.encode(key, mapping的槽位) )
    ```
    也就是：把 **key（左补零到 32 字节）** 和 **mapping 的槽位（32 字节）** 拼在一起，做一次 keccak256，得到的就是「这个 key 在 mapping 里」对应的存储槽位。

所以：

- `_balances[from]` 存在 slot：`keccak256(abi.encode(from, BALANCES_SLOT))`
- `_balances[to]`  存在 slot：`keccak256(abi.encode(to, BALANCES_SLOT))`

**这就是为什么 assembly 里要「把 from 和 BALANCES_SLOT 放进内存，再 keccak256(0x00, 0x40)」—— 就是在手动算这两个 slot。**

---

### 3. 内存（memory）在汇编里怎么用？

- **内存**是临时、按字节寻址的，主要用来：
  - 给 `keccak256(offset, length)` 提供输入（对哪一段内存做哈希），
  - 给 `log*` 提供「事件数据」的指针。
- 常用指令：
  - **mstore(offset, value)**：在内存 `offset` 处写入 32 字节的 `value`（右对齐）。
  - **mload(offset)**：从内存 `offset` 读取 32 字节。

例如：

- `mstore(0x00, from)`：把 `from`（20 字节的 address）写入 0x00，相当于「0x00~0x13 为 0，0x14~0x1F 为 from」，即 32 字节、右对齐。这和 `abi.encode(from)` 的布局一致。
- `mstore(0x20, BALANCES_SLOT)`：在 0x20 处再写 32 字节。
- 这样 0x00~0x3F 共 64 字节，正好是 `abi.encode(from, BALANCES_SLOT)`，所以 `keccak256(0x00, 0x40)` 就等于上面说的 slot 公式。

---

### 4. 存储的读写在汇编里怎么做？

- **sload(slot)**：从存储槽位 `slot` 读取 32 字节，返回值。
- **sstore(slot, value)**：把 32 字节的 `value` 写入存储槽位 `slot`。

所以：

- `sload(fromSlot)` = 读 `_balances[from]`
- `sstore(fromSlot, x)` = 写 `_balances[from] = x`

---

### 5. 事件（Event）在 EVM 里是什么？

- Solidity 的 `emit Transfer(from, to, amount)` 在 EVM 里会变成一条 **log** 指令。
- **log3(memOffset, size, topic0, topic1, topic2)** 表示：
  - **数据**：从内存 `memOffset` 开始、长度为 `size` 的字节（即「事件的数据部分」）；
  - **topic0**：事件签名的 keccak256（例如 `Transfer(address,address,uint256)`）；
  - **topic1、topic2**：两个 indexed 参数（这里就是 from、to）。

ERC20 的 Transfer 定义为：

```solidity
event Transfer(address indexed from, address indexed to, uint256 value);
```

所以：

- topic0 = `keccak256("Transfer(address,address,uint256)")` = 那个常数 `0xddf252ad...`
- topic1 = from，topic2 = to
- 数据部分 = 一个 32 字节的 value（amount）

因此汇编里：先把 `amount` 用 `mstore(0x00, amount)` 放进内存，再用 `log3(0x00, 0x20, topic0, from, to)` 发出一条和 Solidity `emit Transfer(from, to, amount)` 等价的日志。

---

### 6. 小结：这几样东西在 _transferOptimized 里各干什么？

| 概念 | 在函数里的作用 |
|------|----------------|
| mapping 的 slot 公式 | 用 `mstore` + `keccak256` 算出 `fromSlot`、`toSlot`，才能直接 sload/sstore |
| 内存 | 给 keccak256 和 log3 提供输入 |
| sload / sstore | 读/写 `_balances[from]`、`_balances[to]` |
| log3 | 发出 Transfer 事件，和 Solidity 的 emit 一致 |

---

## 二、_transferOptimized 逐行在做什么

下面按「块」说明，并标出对应的行号（以你当前合约为准）。

### 1) 算出「from 的 balance 在哪个 slot」

```text
mstore(0x00, from)           // 内存 0x00~0x1F = abi.encode(from) 的 32 字节
mstore(0x20, BALANCES_SLOT)  // 内存 0x20~0x3F = mapping 的槽位
let fromSlot := keccak256(0x00, 0x40)  // 对 64 字节做哈希 = mapping 的 slot 公式
```

- 前两行在内存里拼出 `abi.encode(from, BALANCES_SLOT)`。
- 第三行得到 `_balances[from]` 的存储槽位，存到变量 `fromSlot`。

（上面 157–161 行里关于 `and(from,...)` 和 `mstore8(0x14,0x00)` 的注释是旧写法遗留，实际生效的是这两行 `mstore` + 一行 `keccak256`。）

### 2) 算出「to 的 balance 在哪个 slot」

```text
mstore(0x00, to)
mstore(0x20, BALANCES_SLOT)
let toSlot := keccak256(0x00, 0x40)
```

- 同样公式，只是 key 换成 `to`，得到 `_balances[to]` 的槽位 `toSlot`。

### 3) 读 from 余额并检查是否足够

```text
let fromBalance := sload(fromSlot)   // 读 _balances[from]
if lt(fromBalance, amount) {
    revert(0x00, 0x00)               // 不够就整体回滚
}
```

- `sload(fromSlot)` 就是「读存储里 from 的余额」。
- 若 `fromBalance < amount`，直接 `revert`，交易全部回滚。

### 4) 扣减 from、增加 to

```text
sstore(fromSlot, sub(fromBalance, amount))  // _balances[from] -= amount
let toBalance := sload(toSlot)              // 读 _balances[to]
sstore(toSlot, add(toBalance, amount))     // _balances[to] += amount
```

- 先写 from 的槽位：余额减 `amount`。
- 再读 to 的当前余额，然后写 to 的槽位：余额加 `amount`。

### 5) 发出 Transfer 事件

```text
mstore(0x00, amount)
log3(0x00, 0x20, 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef, from, to)
```

- 第一行：把 `amount` 写入内存 0x00（作为事件的「数据」）。
- 第二行：用 ERC20 Transfer 的 topic0 + from/to 作为 topic1、topic2，发 log，等价于 `emit Transfer(from, to, amount)`。

---

## 三、和普通 Solidity 写法的对应关系

| Solidity 写法 | Assembly 等价 |
|---------------|----------------|
| `_balances[from]` 读 | `sload(fromSlot)`，其中 `fromSlot = keccak256(abi.encode(from, BALANCES_SLOT))` |
| `_balances[from] = x` | `sstore(fromSlot, x)` |
| `_balances[to] += amount` | `sload(toSlot)` 再 `sstore(toSlot, add(toBalance, amount))` |
| `emit Transfer(from, to, amount)` | `mstore(0x00, amount)` + `log3(0x00, 0x20, topic0, from, to)` |

---

## 四、为什么说这是「优化」？

- 用 Solidity 写 `_balances[from]`、`_balances[to]` 时，编译器会为每次访问生成「算 slot + sload/sstore」的代码，有时还会多出边界检查或临时变量。
- 手写 assembly 可以：
  - 精确控制几次 sload/sstore（例如 from 的余额只读一次、写一次）；
  - 少用栈和内存，减少指令数；
  - 不触发 Solidity 的某些安全检查（因此要自己保证不溢出、不越界）。

所以在高频 transfer 场景下，这类手写存储访问往往能省 gas；代价是可读性差、容易出错，且当前实现里余额不足时是「裸 revert」，不会带 custom error 的 data。

---

如果你愿意，下一步可以：  
- 在 Remix 里对 `_transferOptimized` 单步调试，看每次 `sload`/`sstore` 的 slot 和值；  
- 或者我们针对某一行（比如某条 `mstore` 或 `keccak256`）再拆成「输入是什么、输出是什么」逐字节讲一遍。
