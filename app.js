const SYMBOLS = [
  { sym: "BTC", price: 64210.12 },
  { sym: "ETH", price: 3120.55 },
  { sym: "AAPL", price: 192.34 },
  { sym: "TSLA", price: 248.71 },
  { sym: "NVDA", price: 118.22 },
  { sym: "MSFT", price: 421.66 },
  { sym: "SOL", price: 152.08 },
  { sym: "GOOG", price: 175.91 },
];

const fmt = (n) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function render(container, items) {
  container.innerHTML = items
    .map((it) => {
      const up = it.chg >= 0;
      const sign = up ? "+" : "";
      return `
        <div class="tick">
          <div>
            <div class="sym">${it.sym}</div>
            <div class="price">$${fmt(it.price)}</div>
          </div>
          <div class="chg ${up ? "up" : "down"}">${sign}${it.chg.toFixed(2)}%</div>
        </div>`;
    })
    .join("");
}

function tick(state) {
  return state.map((it) => {
    const drift = (Math.random() - 0.5) * 0.008;
    const newPrice = Math.max(0.01, it.price * (1 + drift));
    const chg = ((newPrice - it.base) / it.base) * 100;
    return { ...it, price: newPrice, chg };
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("ticker");
  if (!container) return;
  let state = SYMBOLS.map((s) => ({ ...s, base: s.price, chg: 0 }));
  render(container, state);
  setInterval(() => {
    state = tick(state);
    render(container, state);
  }, 1000);
});
