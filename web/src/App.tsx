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
          <span className="flex items-center gap-2 font-semibold text-lg tracking-tight text-white">
            <svg width="18" height="18" viewBox="0 0 48 48" fill="none" className="shrink-0">
              <path
                fill="url(#header-glimmer)"
                d="M24 3c1.1 7.7 2.7 12.9 5.4 15.6C32.1 21.3 37.3 22.9 45 24c-7.7 1.1-12.9 2.7-15.6 5.4C26.7 32.1 25.1 37.3 24 45c-1.1-7.7-2.7-12.9-5.4-15.6C15.9 26.7 10.7 25.1 3 24c7.7-1.1 12.9-2.7 15.6-5.4C21.3 15.9 22.9 10.7 24 3Z"
              />
              <defs>
                <radialGradient id="header-glimmer" cx="50%" cy="42%" r="65%">
                  <stop offset="0%" stopColor="#ffe28a" />
                  <stop offset="55%" stopColor="#eda100" />
                  <stop offset="100%" stopColor="#c98500" />
                </radialGradient>
              </defs>
            </svg>
            Glimmer Scout <span className="text-glimmer-300">微光寻者</span>
          </span>
          <span className="hidden md:inline-block text-xs italic text-gray-500 tracking-wide border-l border-white/10 pl-4">
            Catch The Glimmer Before Dawn.
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
                      ? "bg-glimmer-500/15 text-glimmer-300"
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
