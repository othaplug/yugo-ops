/**
 * Key/value rows as one outer `<td>` wrapping a nested 2-column table so
 * `.email-stack-rows` mobile stacking does not force label/value to stack.
 */
export function emailNestedKvRow(options: {
  /** e.g. `1px solid rgba(...)` or `none` for first row under a header */
  borderTop: string;
  labelStyle: string;
  valueStyle: string;
  label: string;
  valueHtml: string;
}): string {
  const bt =
    options.borderTop && options.borderTop !== "none"
      ? `border-top:${options.borderTop};`
      : "";
  return `<tr><td style="padding:0;margin:0;${bt}">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;width:100%;">
      <tr>
        <td valign="top" style="${options.labelStyle}">${options.label}</td>
        <td valign="top" align="right" style="${options.valueStyle}">${options.valueHtml}</td>
      </tr>
    </table>
  </td></tr>`;
}
