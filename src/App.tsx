/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Zap, 
  Coins, 
  Star, 
  Play, 
  CheckCircle2, 
  HelpCircle,
  ShoppingBasket
} from "lucide-react";
import { 
  GameState, 
  ALL_ITEMS, 
  ITEM_CHAINS, 
  Order, 
  ProgressionState
} from "./types";
import { ProgressionManager, EconomyManager } from "./progressionManager";
import { UPGRADES } from "./progressionData";

const GRID_SIZE = 5;
const MAX_GRID_CELLS = GRID_SIZE * GRID_SIZE;
const INITIAL_ENERGY = 100;
const SPAWN_COST = 1;

const STORAGE_KEY = "emoji_merge_harbor_state_v2"; // Changed key to avoid old state issues

export default function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [progState, setProgState] = useState<ProgressionState | null>(null);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showUpgrades, setShowUpgrades] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [lastAction, setLastAction] = useState<{ type: "merge" | "spawn" | "order", index?: number } | null>(null);

  // Initialize or load state
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.gameState && parsed.progState) {
          setState(parsed.gameState);
          setProgState(parsed.progState);
        } else {
          resetGame();
        }
      } else {
        resetGame();
      }
    } catch (e) {
      console.error("Failed to load state:", e);
      resetGame();
    }
  }, []);

  // Save state on change
  useEffect(() => {
    if (state && progState) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ gameState: state, progState }));
      } catch (e) {
        console.error("Failed to save state:", e);
      }
    }
  }, [state, progState]);

  const resetGame = () => {
    const initialProgState: ProgressionState = {
      level: 1,
      xp: 0,
      coins: 0,
      unlockedZones: ["hall"],
      purchasedUpgrades: [],
    };
    const initialGameState: GameState = {
      grid: new Array(MAX_GRID_CELLS).fill(null),
      energy: INITIAL_ENERGY,
      maxEnergy: INITIAL_ENERGY,
      coins: 0,
      xp: 0,
      level: 1,
      orders: generateInitialOrders(),
      isFirstLaunch: true,
    };
    setProgState(initialProgState);
    setState(initialGameState);
    if (initialGameState.isFirstLaunch) setShowTutorial(true);
  };

  function generateInitialOrders(): Order[] {
    return [
      { id: "o1", requiredItemId: "f2", rewardCoins: 15, rewardXp: 10 },
      { id: "o2", requiredItemId: "s2", rewardCoins: 20, rewardXp: 15 },
    ];
  }

  const generateNewOrder = (level: number): Order => {
    const chains = Object.values(ITEM_CHAINS);
    const randomChain = chains[Math.floor(Math.random() * chains.length)];
    const maxItemLevel = Math.min(level + 1, 7);
    const randomLevel = Math.floor(Math.random() * maxItemLevel) + 1;
    const item = randomChain.items[randomLevel - 1];
    
    const difficulty = randomLevel < 3 ? "simple" : randomLevel < 5 ? "medium" : "hard";
    const reward = EconomyManager.calculateOrderReward(difficulty);

    return {
      id: Math.random().toString(36).substr(2, 9),
      requiredItemId: item.id,
      rewardCoins: reward.coins,
      rewardXp: reward.xp,
    };
  };

  const handleSpawn = () => {
    if (!state || state.energy < SPAWN_COST) return;

    const emptyIndices = state.grid
      .map((item, index) => (item === null ? index : null))
      .filter((index): index is number => index !== null);

    if (emptyIndices.length === 0) return;

    const randomIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    const chains = Object.values(ITEM_CHAINS);
    const randomChain = chains[Math.floor(Math.random() * chains.length)];
    const newItemId = randomChain.items[0].id;

    const newGrid = [...state.grid];
    newGrid[randomIndex] = newItemId;

    setState({
      ...state,
      grid: newGrid,
      energy: state.energy - SPAWN_COST,
    });
    setLastAction({ type: "spawn", index: randomIndex });
  };

  const handleCellClick = (index: number) => {
    if (!state || !progState) return;

    if (selectedCell === null) {
      if (state.grid[index] !== null) {
        setSelectedCell(index);
      }
    } else {
      if (selectedCell === index) {
        setSelectedCell(null);
      } else {
        const itemAId = state.grid[selectedCell];
        const itemBId = state.grid[index];

        if (itemAId && itemBId && itemAId === itemBId) {
          const itemDef = ALL_ITEMS[itemAId];
          const chain = ITEM_CHAINS[itemDef.chain];
          const nextItem = chain.items[itemDef.level];

          if (nextItem) {
            const newGrid = [...state.grid];
            newGrid[selectedCell] = null;
            newGrid[index] = nextItem.id;

            const manager = new ProgressionManager(progState);
            const { leveledUp, newState: newProg } = manager.addXp(itemDef.level);
            
            if (leveledUp) {
              setShowLevelUp(true);
              setTimeout(() => setShowLevelUp(false), 2000);
            }

            setProgState(newProg);
            setState({
              ...state,
              grid: newGrid,
              level: newProg.level,
              xp: newProg.xp,
              coins: newProg.coins,
              energy: leveledUp ? state.maxEnergy : state.energy
            });
            setSelectedCell(null);
            setLastAction({ type: "merge", index });
          } else {
            setSelectedCell(index);
          }
        } else {
          const newGrid = [...state.grid];
          const temp = newGrid[index];
          newGrid[index] = newGrid[selectedCell];
          newGrid[selectedCell] = temp;
          
          setState({ ...state, grid: newGrid });
          setSelectedCell(null);
        }
      }
    }
  };

  const handleCompleteOrder = (orderId: string) => {
    if (!state || !progState) return;
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return;

    const itemIndex = state.grid.findIndex(id => id === order.requiredItemId);
    if (itemIndex === -1) return;

    const newGrid = [...state.grid];
    newGrid[itemIndex] = null;

    const newOrders = state.orders.filter(o => o.id !== orderId);
    newOrders.push(generateNewOrder(progState.level));

    const manager = new ProgressionManager(progState);
    const { leveledUp, newState: newProg } = manager.addXp(order.rewardXp);
    newProg.coins += order.rewardCoins;

    if (leveledUp) {
      setShowLevelUp(true);
      setTimeout(() => setShowLevelUp(false), 2000);
    }

    setProgState(newProg);
    setState({
      ...state,
      grid: newGrid,
      orders: newOrders,
      level: newProg.level,
      xp: newProg.xp,
      coins: newProg.coins,
      energy: leveledUp ? state.maxEnergy : state.energy
    });
    setLastAction({ type: "order" });
  };

  const handlePurchaseUpgrade = (upgradeId: string) => {
    if (!progState || !state) return;
    const manager = new ProgressionManager(progState);
    const { success, newState: newProg, error } = manager.purchaseUpgrade(upgradeId);

    if (success) {
      const bonuses = manager.getActiveBonuses();
      setProgState(newProg);
      setState({
        ...state,
        maxEnergy: INITIAL_ENERGY + bonuses.energy_max,
        coins: newProg.coins
      });
    } else {
      alert(error);
    }
  };

  if (!state || !progState) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-[#F8F9FA] p-4 text-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Загрузка игры...</h1>
        <p className="text-sm text-gray-500 mb-4">Если игра не загружается, попробуйте сбросить данные.</p>
        <button 
          onClick={resetGame}
          className="px-4 py-2 bg-red-500 text-white rounded-lg font-bold text-sm shadow-md"
        >
          СБРОСИТЬ ДАННЫЕ
        </button>
      </div>
    );
  }

  const manager = new ProgressionManager(progState);
  const xpToNextLevel = manager.getXpToNextLevel(progState.level);
  const progress = (progState.xp / xpToNextLevel) * 100;

  return (
    <div className="h-[100dvh] w-full bg-[#F8F9FA] flex flex-col items-center p-2 font-sans select-none overflow-hidden">
      {/* Header */}
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm p-2 mb-1.5 flex justify-between items-center border border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded-full border border-blue-100">
          <Zap className="w-3.5 h-3.5 text-blue-500 fill-blue-500" />
          <span className="font-bold text-xs text-blue-700">{state.energy}/{state.maxEnergy}</span>
        </div>
        <div className="flex flex-col items-center flex-1 px-2">
          <div className="flex items-center gap-1 mb-0.5">
            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Уровень {progState.level}</span>
          </div>
          <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-yellow-400" 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-yellow-50 px-2 py-1 rounded-full border border-yellow-100">
          <Coins className="w-3.5 h-3.5 text-yellow-600 fill-yellow-600" />
          <span className="font-bold text-xs text-yellow-700">{progState.coins}</span>
        </div>
      </div>

      {/* Orders */}
      <div className="w-full max-w-md mb-1.5 flex gap-2 overflow-x-auto pb-1 no-scrollbar flex-shrink-0">
        {state.orders.map((order) => {
          const item = ALL_ITEMS[order.requiredItemId];
          const hasItem = state.grid.includes(order.requiredItemId);
          return (
            <motion.div 
              key={order.id}
              layout
              className={`flex-shrink-0 w-24 bg-white rounded-lg p-1.5 border-2 transition-colors ${hasItem ? 'border-green-400 bg-green-50' : 'border-gray-100'}`}
            >
              <div className="flex justify-between items-start mb-0.5">
                <span className="text-lg">{item.emoji}</span>
                {hasItem && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
              </div>
              <div className="text-[7px] font-bold text-gray-400 uppercase mb-0.5 truncate">{item.name}</div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-0.5">
                  <Coins className="w-2 h-2 text-yellow-600" />
                  <span className="text-[9px] font-bold">{order.rewardCoins}</span>
                </div>
                <button 
                  onClick={() => handleCompleteOrder(order.id)}
                  disabled={!hasItem}
                  className={`px-1 py-0.5 rounded text-[7px] font-bold uppercase ${hasItem ? 'bg-green-500 text-white shadow-sm' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                >
                  Отдать
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Grid Container */}
      <div className="flex-1 flex items-center justify-center w-full max-w-md min-h-0 py-1">
        <div className="relative bg-gray-200 p-1 rounded-[1.25rem] shadow-inner border border-white w-full aspect-square max-h-full max-w-full overflow-hidden">
          <div 
            className="grid gap-1 h-full w-full"
            style={{ 
              gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
              gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
            }}
          >
            {state.grid.map((itemId, index) => {
              const item = itemId ? ALL_ITEMS[itemId] : null;
              const isSelected = selectedCell === index;

              return (
                <div 
                  key={index}
                  onClick={() => handleCellClick(index)}
                  className={`relative bg-white/50 rounded-md flex items-center justify-center cursor-pointer transition-all duration-200 aspect-square w-full h-full ${isSelected ? 'ring-2 ring-blue-400 ring-inset bg-blue-50' : 'hover:bg-white/80'}`}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <AnimatePresence mode="popLayout">
                      {item && (
                        <motion.div
                          key={`${itemId}-${index}`}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          className="text-2xl sm:text-3xl md:text-4xl pointer-events-none"
                        >
                          {item.emoji}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  {/* Level Badge */}
                  {item && (
                    <div className="absolute bottom-0.5 right-0.5 bg-white/90 px-0.5 rounded text-[6px] font-black text-gray-500 shadow-sm z-10">
                      L{item.level}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="w-full max-w-md mt-1.5 flex justify-between items-center px-2 flex-shrink-0">
        <button 
          onClick={() => setShowUpgrades(true)}
          className="p-2.5 bg-white rounded-lg shadow-sm border border-gray-100 text-gray-400 hover:text-blue-500 transition-colors"
        >
          <ShoppingBasket className="w-5 h-5" />
        </button>

        <motion.button 
          whileTap={{ scale: 0.95 }}
          onClick={handleSpawn}
          disabled={state.energy < SPAWN_COST}
          className={`group relative flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-base shadow-md transition-all ${state.energy >= SPAWN_COST ? 'bg-blue-500 text-white shadow-blue-100 active:bg-blue-600' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
        >
          <Zap className="w-5 h-5 fill-current" />
          <span>СОЗДАТЬ</span>
          <div className="absolute -top-1.5 -right-1.5 bg-yellow-400 text-yellow-900 text-[9px] px-1.5 py-0.5 rounded-full border border-white flex items-center gap-0.5 font-black">
            <Zap className="w-2 h-2 fill-current" />
            {SPAWN_COST}
          </div>
        </motion.button>

        <button 
          onClick={() => setShowTutorial(true)}
          className="p-2.5 bg-white rounded-lg shadow-sm border border-gray-100 text-gray-400 hover:text-blue-500 transition-colors"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>

      {/* Upgrades Modal */}
      <AnimatePresence>
        {showUpgrades && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-[2rem] p-6 max-w-sm w-full shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Улучшения</h2>
                <button onClick={() => setShowUpgrades(false)} className="text-gray-400">&times;</button>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 no-scrollbar">
                {UPGRADES.map(upgrade => {
                  const isUnlocked = progState.level >= upgrade.requiredLevel;
                  const isPurchased = progState.purchasedUpgrades.includes(upgrade.id);
                  const canAfford = progState.coins >= upgrade.cost;
                  const zoneUnlocked = progState.unlockedZones.includes(upgrade.zone);

                  return (
                    <div 
                      key={upgrade.id}
                      className={`p-3 rounded-xl border-2 ${isPurchased ? 'border-green-200 bg-green-50' : 'border-gray-100'}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-sm">{upgrade.name}</span>
                        {isPurchased ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <div className="flex items-center gap-1">
                            <Coins className="w-3 h-3 text-yellow-600" />
                            <span className="text-xs font-bold">{upgrade.cost}</span>
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 mb-2">{upgrade.description}</p>
                      {!isPurchased && (
                        <button
                          disabled={!isUnlocked || !canAfford || !zoneUnlocked}
                          onClick={() => handlePurchaseUpgrade(upgrade.id)}
                          className={`w-full py-1.5 rounded-lg text-[10px] font-bold uppercase ${isUnlocked && canAfford && zoneUnlocked ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'}`}
                        >
                          {!zoneUnlocked ? `Нужна зона: ${upgrade.zone}` : !isUnlocked ? `Нужен ур. ${upgrade.requiredLevel}` : 'Купить'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tutorial Overlay */}
      <AnimatePresence>
        {showTutorial && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-[2rem] p-6 max-w-xs w-full text-center shadow-2xl"
            >
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Play className="w-8 h-8 text-blue-500 fill-blue-500" />
              </div>
              <h2 className="text-xl font-black text-gray-900 mb-3 uppercase tracking-tight">Как играть</h2>
              <div className="space-y-3 text-gray-600 text-xs mb-6 text-left">
                <div className="flex gap-2">
                  <div className="w-5 h-5 bg-blue-500 text-white rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold">1</div>
                  <p>Нажми <b>СОЗДАТЬ</b>, чтобы получить предмет. Это стоит 1 Энергию.</p>
                </div>
                <div className="flex gap-2">
                  <div className="w-5 h-5 bg-blue-500 text-white rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold">2</div>
                  <p>Объединяй <b>одинаковые</b> предметы, чтобы получить новый уровень!</p>
                </div>
                <div className="flex gap-2">
                  <div className="w-5 h-5 bg-blue-500 text-white rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold">3</div>
                  <p>Выполняй <b>Заказы</b> сверху, чтобы получать Монеты и Опыт.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowTutorial(false)}
                className="w-full py-3 bg-blue-500 text-white rounded-xl font-bold text-base shadow-lg shadow-blue-100 hover:bg-blue-600 transition-colors"
              >
                ПОНЯТНО!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Level Up Effect */}
      <AnimatePresence>
        {showLevelUp && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none"
          >
            <div className="bg-yellow-400 text-yellow-900 px-8 py-4 rounded-full font-black text-2xl shadow-2xl border-4 border-white flex flex-col items-center">
              <Star className="w-8 h-8 mb-1 fill-current" />
              НОВЫЙ УРОВЕНЬ!
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
