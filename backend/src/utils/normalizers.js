function nullableText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function requiredText(value, fieldName) {
  const text = nullableText(value);
  if (!text) {
    const error = new Error(`${fieldName} 不能为空`);
    error.statusCode = 400;
    throw error;
  }
  return text;
}

function nullableDateTime(value) {
  if (!value) {
    return null;
  }

  return String(value).replace('T', ' ').slice(0, 19);
}

function numberInRange(value, fieldName, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    const error = new Error(`${fieldName} 必须是 ${min} 到 ${max} 之间的数字`);
    error.statusCode = 400;
    throw error;
  }
  return number;
}

function integerOrDefault(value, defaultValue = 0) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const number = Number(value);
  if (!Number.isInteger(number)) {
    const error = new Error('order_index 必须是整数');
    error.statusCode = 400;
    throw error;
  }
  return number;
}

module.exports = {
  integerOrDefault,
  nullableDateTime,
  nullableText,
  numberInRange,
  requiredText
};
