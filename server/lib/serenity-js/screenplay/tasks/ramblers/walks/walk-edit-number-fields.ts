export function walkEditStepNumberValue(value: string, step = 0.1): string {
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed) || step <= 0) {
    return value;
  } else {
    const decimals = (String(step).split(".")[1] || "").length;
    return (Math.round(parsed / step) * step).toFixed(decimals);
  }
}

export function snapMetricImperialNumberInputs(documentRef: Document): {id: string; value: string}[] {
  return Array.from(documentRef.querySelectorAll("input[data-factor][step]")).map(element => {
    const input = element as HTMLInputElement;
    input.value = walkEditStepNumberValue(input.value, parseFloat(input.step) || 0.1);
    return {id: input.id, value: input.value};
  });
}

export function snapMetricImperialNumberInputsScript(): string {
  return `(() => { ${walkEditStepNumberValue.toString()} ${snapMetricImperialNumberInputs.toString()} return snapMetricImperialNumberInputs(document); })()`;
}
