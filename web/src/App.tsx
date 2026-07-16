import { NavLink, Route, Routes } from "react-router-dom";
import clsx from "clsx";
import MatrixPage from "./pages/MatrixPage";
import BacktestPage from "./pages/BacktestPage";
import SystemStatusPage from "./pages/SystemStatusPage";
import { useDataset } from "./lib/useDataset";

const NAV_ITEMS = [
  { to: "/", label: "引爆矩阵" },
  { to: "/backtest", label: "回测对照" },
  { to: "/status", label: "系统状态" },
];

function App() {
  const { error } = useDataset();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0b0d12]/90 backdrop-blur">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center gap-8">
          <span className="font-semibold text-lg tracking-tight text-white">
            NextScout <span className="text-fuchsia-400">引爆雷达</span>
          </span>
          <nav className="flex gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  clsx(
                    "px-3 py-1.5 rounded-md text-sm transition-colors",
                    isActive
                      ? "bg-fuchsia-500/15 text-fuchsia-300"
                      : "text-gray-400 hover:text-gray-200 hover:bg-white/5",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {error && (
        <div className="bg-red-500/10 text-red-300 text-sm px-6 py-2 text-center">
          数据加载失败：{error}
        </div>
      )}

      <main className="flex-1 max-w-[1400px] mx-auto w-full px-6 py-6">
        <Routes>
          <Route path="/" element={<MatrixPage />} />
          <Route path="/backtest" element={<BacktestPage />} />
          <Route path="/status" element={<SystemStatusPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
