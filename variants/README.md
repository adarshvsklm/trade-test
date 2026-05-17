# Variants

This directory archives alternative implementations of the trading agent that
were built in parallel on separate `cursor/*` branches. Each subdirectory
contains the full source tree of one branch exactly as it existed at the time
it was merged into `main`.

The **primary, supported app** is the one at the repository root (`backend/` +
`frontend/`). The variants are kept only as references — they may use
different stacks (some are pure-JS, some have their own Node backend, etc.)
and are not wired up to the root README or CI.

Each variant came from a branch of the same name with a `cursor/` prefix:

| Variant directory                              | Source branch                                  |
| ---------------------------------------------- | ---------------------------------------------- |
| `trading-agent-050a/`                          | `cursor/trading-agent-050a`                    |
| `trading-agent-c4ae/`                          | `cursor/trading-agent-c4ae`                    |
| `trading-agent-dashboard-3682/`                | `cursor/trading-agent-dashboard-3682`          |
| `trading-agent-ui-204d/`                       | `cursor/trading-agent-ui-204d`                 |
| `trading-agent-ui-ac01/`                       | `cursor/trading-agent-ui-ac01`                 |
| `trading-agent-ui-b801/`                       | `cursor/trading-agent-ui-b801`                 |
| `trading-agent-ui-backtest-43c4/`              | `cursor/trading-agent-ui-backtest-43c4`        |
| `trading-agent-ui-c0e6/`                       | `cursor/trading-agent-ui-c0e6`                 |
| `trading-agent-ui-d312/`                       | `cursor/trading-agent-ui-d312`                 |
| `trading-agent-ui-f515/`                       | `cursor/trading-agent-ui-f515`                 |

To explore one of them, `cd` into its directory and read its own README /
package.json for setup instructions.
