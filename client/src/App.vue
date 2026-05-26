<template>
  <router-view />
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --color-bg: #f5f5f5;
  --color-surface: #fff;
  --color-border: #e0e0e0;
  --color-text: #1a1a1a;
  --color-text-secondary: #666;
  --color-primary: #4f46e5;
  --color-primary-hover: #4338ca;
  --color-danger: #dc2626;
  --color-success: #16a34a;
  --radius: 8px;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: var(--color-bg);
  color: var(--color-text);
  line-height: 1.6;
}

button {
  cursor: pointer;
  border: none;
  border-radius: var(--radius);
  padding: 8px 16px;
  font-size: 14px;
  transition: background 0.15s;
}

input, textarea {
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 8px 12px;
  font-size: 14px;
  outline: none;
}
input:focus, textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.15);
}
</style>
