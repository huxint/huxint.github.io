---
title: "Transformer：理解 Attention Is All You Need"
description: "把注意力、多头和位置编码理清楚，再看编码器与解码器怎样配合完成翻译。"
pubDate: 2026-09-06T10:00:00+08:00
tags: ["机器学习", "论文笔记"]
---

[《Attention Is All You Need》](https://arxiv.org/abs/1706.03762) 研究的是机器翻译。读这篇论文，可以先抓住注意力这一件事：一个词在更新自己的表示时，应该参考句子里的哪些词。

Transformer 让每个位置直接与其他位置计算关联，再把相关的信息汇总过来。这样，相隔很远的两个词也能直接交换信息。

## 注意力怎么算

每个词先通过三个线性变换，得到 $Q$、$K$、$V$：

$$
Q=XW^Q,\qquad K=XW^K,\qquad V=XW^V.
$$

$Q$ 负责发起查询，$K$ 拿来匹配，$V$ 装着要汇总的信息。它们都来自输入 $X$，但各自用了不同的参数。这就是自注意力。

计算过程可以写成

$$
\operatorname{Attention}(Q,K,V)
=\operatorname{softmax}\left(\frac{QK^\top}{\sqrt{d_k}}\right)V.
$$

先让 $Q$ 和所有 $K$ 做点积，得到分数；再对每一行做 softmax，变成权重；最后按权重对 $V$ 求和。分数高的位置，就会贡献更多信息。

$d_k$ 是键向量的维数。除以 $\sqrt{d_k}$，是为了缓和点积随维数增大而变大的问题，避免 softmax 过于偏向少数位置。

这里要计算每对位置之间的分数，所以序列长度翻倍，分数的数量就会变成四倍。长序列下，注意力的开销也会跟着上来。

## 为什么要多头

只算一次注意力，每个位置只能得到一组权重。多头注意力用了多组投影参数，让模型同时学习不同的关联。

以自注意力为例：

$$
\begin{aligned}
\operatorname{head}_i
&=\operatorname{Attention}(XW_i^Q,XW_i^K,XW_i^V),\\
\operatorname{MultiHead}(X)
&=\operatorname{Concat}(\operatorname{head}_1,\ldots,\operatorname{head}_h)W^O.
\end{aligned}
$$

每个头分别计算，最后把结果拼起来，再过一个线性层。不同的头可以关注不同的关系，具体怎么分工由训练决定。

## 把位置信息加进去

光看词之间的匹配关系，模型还缺少前后顺序的信息。于是，在词向量上再加一份位置编码。

原论文使用不同频率的正弦和余弦：

$$
\begin{aligned}
\operatorname{PE}(pos,2i)
&=\sin\left(\frac{pos}{10000^{2i/d_{\text{model}}}}\right),\\
\operatorname{PE}(pos,2i+1)
&=\cos\left(\frac{pos}{10000^{2i/d_{\text{model}}}}\right).
\end{aligned}
$$

每个位置都有自己的编码，模型因此能同时读到词的内容和位置。正弦、余弦也让位置偏移之间带有比较规整的关系。

## 编码器和解码器怎么配合

编码器负责读原句。每层先做自注意力，让各个位置交换信息，再让每个位置经过一个前馈网络。

解码器负责生成译文。它先看已经生成的词，再通过交叉注意力去读编码器的输出。交叉注意力里的 $Q$ 来自解码器，$K$ 和 $V$ 来自编码器。

![Transformer 的编码器与解码器结构](./architecture.svg "原论文中，编码器和解码器都堆叠了六层。")

前馈网络就是两层线性变换，中间接一个 ReLU：

$$
\operatorname{FFN}(x)=\max(0,xW_1+b_1)W_2+b_2.
$$

它对每个位置分别处理，参数在同一层内共享。每个子层还会加回自己的输入，再做 LayerNorm，也就是图里的 Add & Norm。

## 训练时并行，生成时逐步来

预测下一个词时，不能提前看到后面的答案。训练时先把目标句子右移一位：比如目标是 `A B C`，就用 `<start> A B` 作为输入，分别预测 `A B C`。

还要给解码器的自注意力加上因果掩码，把未来位置的分数设成 $-\infty$，经过 softmax 后，这些位置的权重就是 $0$。

训练时，整句目标文本已经给出，所以各个位置可以一起计算。真正生成时，后面的词还不存在，只能生成一个，把它接到已有内容后面，再预测下一个。

## 参考

- Vaswani et al. [Attention Is All You Need](https://arxiv.org/abs/1706.03762), 2017。
- [论文 PDF](https://arxiv.org/pdf/1706.03762)
