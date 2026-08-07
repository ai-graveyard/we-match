// 字典里的值必须是可序列化的纯数据——客户端组件通过 RSC payload 拿字典，
// 函数过不了这个边界。所以带变量的文案写成 "{n} 条"，渲染时用 fmt 填。

export type Vars = Record<string, string | number>;

/** fmt("{n} 条进行中", { n: 3 }) → "3 条进行中"。缺的变量原样留着，方便一眼看出漏传 */
export function fmt(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in vars ? String(vars[key]) : whole,
  );
}

/**
 * 英文要区分单复数，中文不用。字典里写成 { one, other } 两条，
 * 中文两条填一样的内容即可，读起来比在代码里判断语言清楚。
 */
export type Plural = { one: string; other: string };

export function plural(forms: Plural, n: number, vars?: Vars): string {
  return fmt(n === 1 ? forms.one : forms.other, { n, ...vars });
}
