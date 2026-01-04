import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SudokuBoard = () => {
  const [puzzle, setPuzzle] = useState(Array(9).fill().map(() => Array(9).fill(0)));
  const [originalPuzzle, setOriginalPuzzle] = useState(Array(9).fill().map(() => Array(9).fill(0)));
  const [gameId, setGameId] = useState(null);
  const [difficulty, setDifficulty] = useState('medium');
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [selectedCell, setSelectedCell] = useState({ row: -1, col: -1 });
  const [gameHistory, setGameHistory] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [mistakes, setMistakes] = useState(0);
  const [invalidCells, setInvalidCells] = useState(new Set());
  
  // Timer control states
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [timerRunning, setTimerRunning] = useState(false);
  const [pausedTime, setPausedTime] = useState(0);

  const API_BASE = 'http://localhost:5000/api';

  // Clear error message after 3 seconds
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => {
        setErrorMessage('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // Timer effect with pause functionality
  useEffect(() => {
    let interval = null;
    if (timerEnabled && timerRunning && !completed && startTime) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime - pausedTime) / 1000));
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timerEnabled, timerRunning, completed, startTime, pausedTime]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTimerToggle = () => {
    if (!timerEnabled) return;
    
    if (timerRunning) {
      // Pause timer
      setTimerRunning(false);
      setPausedTime(prev => prev + (Date.now() - startTime - prev));
    } else {
      // Resume timer
      setTimerRunning(true);
      if (!startTime) {
        setStartTime(Date.now());
        setPausedTime(0);
      }
    }
  };

  const resetTimer = () => {
    setStartTime(Date.now());
    setElapsedTime(0);
    setPausedTime(0);
    setTimerRunning(timerEnabled);
  };

  // Validate if a number can be placed in a specific position
  const isValidMove = (grid, row, col, num) => {
    // Check row
    for (let x = 0; x < 9; x++) {
      if (x !== col && grid[row][x] === num) {
        return false;
      }
    }
    
    // Check column
    for (let x = 0; x < 9; x++) {
      if (x !== row && grid[x][col] === num) {
        return false;
      }
    }
    
    // Check 3x3 box
    const startRow = row - (row % 3);
    const startCol = col - (col % 3);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const currentRow = startRow + i;
        const currentCol = startCol + j;
        if ((currentRow !== row || currentCol !== col) && 
            grid[currentRow][currentCol] === num) {
          return false;
        }
      }
    }
    
    return true;
  };

  const startNewGame = async () => {
    try {
      const response = await axios.post(`${API_BASE}/new-game`, {
        difficulty: difficulty,
        user_id: 'player1'
      });
      
      setPuzzle(response.data.puzzle);
      setOriginalPuzzle(response.data.puzzle.map(row => [...row]));
      setGameId(response.data.game_id);
      setCompleted(false);
      setSelectedCell({ row: -1, col: -1 });
      setGameHistory([]);
      setGameStarted(true);
      setErrorMessage('');
      setMistakes(0);
      setInvalidCells(new Set());
      
      // Reset and start timer based on setting
      if (timerEnabled) {
        setStartTime(Date.now());
        setElapsedTime(0);
        setPausedTime(0);
        setTimerRunning(true);
      } else {
        setStartTime(null);
        setElapsedTime(0);
        setPausedTime(0);
        setTimerRunning(false);
      }
    } catch (error) {
      console.error('Error starting new game:', error);
    }
  };

  const saveToHistory = (newPuzzle) => {
    setGameHistory(prev => [...prev, puzzle.map(row => [...row])]);
  };

  const handleCellChange = async (row, col, value) => {
    if (originalPuzzle[row][col] !== 0) return;
    
    const numValue = value === '' ? 0 : parseInt(value);
    if (isNaN(numValue) || numValue < 0 || numValue > 9) return;

    // Start timer on first move if enabled and not running
    if (timerEnabled && !timerRunning && !startTime && numValue !== 0) {
      setStartTime(Date.now());
      setTimerRunning(true);
      setPausedTime(0);
    }

    // Save current state to history before making change
    saveToHistory(puzzle);

    const newPuzzle = puzzle.map(r => [...r]);
    newPuzzle[row][col] = numValue;

    // Clear previous error state for this cell
    const newInvalidCells = new Set(invalidCells);
    newInvalidCells.delete(`${row}-${col}`);
    setInvalidCells(newInvalidCells);

    // Check if the move is valid (only if placing a number, not erasing)
    if (numValue !== 0) {
      if (!isValidMove(newPuzzle, row, col, numValue)) {
        // Invalid move - show error
        setErrorMessage(`Wrong move! Number ${numValue} conflicts with existing numbers in the same row, column, or 3×3 box.`);
        setMistakes(prev => prev + 1);
        
        // Mark this cell as invalid
        newInvalidCells.add(`${row}-${col}`);
        setInvalidCells(newInvalidCells);
        
        // Still place the number but show it as invalid
        setPuzzle(newPuzzle);
        return;
      } else {
        // Valid move - clear any error message
        setErrorMessage('');
      }
    }

    setPuzzle(newPuzzle);

    // Check if puzzle is completed (only if no invalid cells)
    if (numValue !== 0 && newInvalidCells.size === 0) {
      try {
        const response = await axios.post(`${API_BASE}/check-completion`, {
          puzzle: newPuzzle
        });
        
        if (response.data.completed) {
          setCompleted(true);
          setGameStarted(false);
          setTimerRunning(false); // Stop timer on completion
          
          await axios.post(`${API_BASE}/save-game`, {
            game_id: gameId,
            current_state: newPuzzle,
            time_taken: elapsedTime,
            completed: true
          });
          
          const completionMessage = timerEnabled 
            ? `Congratulations! You completed the puzzle in ${formatTime(elapsedTime)} with ${mistakes} mistakes!`
            : `Congratulations! You completed the puzzle with ${mistakes} mistakes!`;
          
          alert(completionMessage);
        }
      } catch (error) {
        console.error('Error checking completion:', error);
      }
    }
  };

  const handleNumberSelect = (number) => {
    if (selectedCell.row === -1 || selectedCell.col === -1) {
      setErrorMessage('Please select a cell first!');
      return;
    }
    
    if (originalPuzzle[selectedCell.row][selectedCell.col] !== 0) {
      setErrorMessage('Cannot modify original numbers!');
      return;
    }

    handleCellChange(selectedCell.row, selectedCell.col, number.toString());
  };

  const handleErase = () => {
    if (selectedCell.row === -1 || selectedCell.col === -1) {
      setErrorMessage('Please select a cell first!');
      return;
    }
    
    if (originalPuzzle[selectedCell.row][selectedCell.col] !== 0) {
      setErrorMessage('Cannot erase original numbers!');
      return;
    }

    // Remove from invalid cells when erasing
    const newInvalidCells = new Set(invalidCells);
    newInvalidCells.delete(`${selectedCell.row}-${selectedCell.col}`);
    setInvalidCells(newInvalidCells);

    handleCellChange(selectedCell.row, selectedCell.col, '');
  };

  const handleUndo = () => {
    if (gameHistory.length === 0) {
      setErrorMessage('Nothing to undo!');
      return;
    }

    const previousState = gameHistory[gameHistory.length - 1];
    setPuzzle(previousState);
    setGameHistory(prev => prev.slice(0, -1));
    
    // Clear invalid cells on undo
    setInvalidCells(new Set());
    setErrorMessage('');
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset the game? All progress will be lost.')) {
      setPuzzle(originalPuzzle.map(row => [...row]));
      setGameHistory([]);
      setSelectedCell({ row: -1, col: -1 });
      setErrorMessage('');
      setMistakes(0);
      setInvalidCells(new Set());
      
      // Reset timer
      if (timerEnabled) {
        resetTimer();
      }
    }
  };

  const handleTimerEnabledToggle = () => {
    const newTimerEnabled = !timerEnabled;
    setTimerEnabled(newTimerEnabled);
    
    if (!newTimerEnabled) {
      // Disable timer
      setTimerRunning(false);
      setStartTime(null);
      setElapsedTime(0);
      setPausedTime(0);
    } else if (gameStarted) {
      // Enable timer - start fresh
      setStartTime(Date.now());
      setElapsedTime(0);
      setPausedTime(0);
      setTimerRunning(true);
    }
  };

  const handleCellFocus = (row, col) => {
    setSelectedCell({ row, col });
    setErrorMessage(''); // Clear error when selecting new cell
  };

  const getCellClasses = (rowIndex, colIndex, cell) => {
    const isOriginal = originalPuzzle[rowIndex][colIndex] !== 0;
    const isSelected = selectedCell.row === rowIndex && selectedCell.col === colIndex;
    const isInSameRowOrCol = selectedCell.row === rowIndex || selectedCell.col === colIndex;
    const isInSameBox = Math.floor(selectedCell.row / 3) === Math.floor(rowIndex / 3) && 
                      Math.floor(selectedCell.col / 3) === Math.floor(colIndex / 3);
    const isInvalid = invalidCells.has(`${rowIndex}-${colIndex}`);
    
    let classes = 'w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-center text-sm sm:text-base md:text-lg font-bold transition-all duration-200 cursor-pointer ';
    
    // Background colors
    if (isInvalid) {
      classes += 'bg-red-200 ';
    } else if (isSelected) {
      classes += 'bg-blue-300 ';
    } else if (isInSameRowOrCol || isInSameBox) {
      classes += 'bg-blue-50 ';
    } else if (isOriginal) {
      classes += 'bg-gray-100 ';
    } else {
      classes += 'bg-white ';
    }
    
    // Text colors
    if (isInvalid) {
      classes += 'text-red-600 ';
    } else if (isOriginal) {
      classes += 'text-gray-800 ';
    } else {
      classes += 'text-blue-600 ';
    }
    
    // Borders
    classes += 'border border-gray-300 ';
    
    // Invalid cell border
    if (isInvalid) {
      classes += 'border-red-500 border-2 ';
    }
    
    // Slightly thicker borders for 3x3 sections
    if (rowIndex % 3 === 0) classes += 'border-t-2 border-t-gray-600 ';
    if (colIndex % 3 === 0) classes += 'border-l-2 border-l-gray-600 ';
    if (rowIndex === 8) classes += 'border-b-2 border-b-gray-600 ';
    if (colIndex === 8) classes += 'border-r-2 border-r-gray-600 ';
    
    // Focus styles
    classes += 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 ';
    
    // Hover effect
    classes += 'hover:bg-blue-100 ';
    
    return classes;
  };

  useEffect(() => {
    startNewGame();
  }, []);

  return (
    <div className="min-h-screen bg-blue-50 py-4 sm:py-6 md:py-8 px-2 sm:px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-4 sm:mb-6 md:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800 mb-2">Sudoku Game</h1>
          <p className="text-gray-600 text-sm sm:text-base">Challenge your mind with this classic puzzle</p>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 text-center animate-pulse">
            <p className="font-semibold">{errorMessage}</p>
          </div>
        )}

        {/* Enhanced Game Controls - Single Row Layout */}
        <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4 md:p-6 mb-4 sm:mb-6">
          {/* Single Row - All controls in one line for larger screens, 2 lines for smaller screens */}
          <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
            
            {/* Left Side - Game Settings */}
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
              {/* Difficulty */}
              <div className="flex items-center gap-2">
                <label className="text-gray-700 font-semibold text-sm">Difficulty:</label>
                <select 
                  value={difficulty} 
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="easy">Easy</option>
                  <option value="medium"> Medium</option>
                  <option value="hard"> Hard</option>
                </select>
              </div>

              {/* Timer Toggle */}
              <div className="flex items-center gap-2">
                <label className="text-gray-700 font-semibold text-sm">Timer:</label>
                <button
                  onClick={handleTimerEnabledToggle}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    timerEnabled 
                      ? 'bg-green-500 hover:bg-green-600 text-white' 
                      : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
                  }`}
                >
                  {timerEnabled ? '✓ On' : '✗ Off'}
                </button>
              </div>

              {/* Mistakes Counter */}
              <div className="bg-red-100 px-3 py-1.5 rounded-lg">
                <span className="text-red-700 font-semibold text-sm">
                   {mistakes} mistakes
                </span>
              </div>
            </div>

            {/* Center - Timer Display and Controls */}
            {timerEnabled && (
              <div className="flex items-center gap-2">
                <div className="bg-gray-100 px-3 py-1.5 rounded-lg">
                  <span className="text-gray-700 font-semibold text-sm">
                    ⏱ {formatTime(elapsedTime)}
                  </span>
                </div>
                <button
                  onClick={handleTimerToggle}
                  className={`px-3 py-1.5 rounded-lg font-semibold text-sm transition-all duration-200 ${
                    timerRunning 
                      ? 'bg-yellow-500 hover:bg-yellow-600 text-white' 
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  {timerRunning ? '⏸' : '▶'}
                </button>
                <button
                  onClick={resetTimer}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg font-semibold text-sm transition-all duration-200"
                >
                  Reset Timer
                </button>
              </div>
            )}

            {/* Right Side - New Game Button */}
            <button 
              onClick={startNewGame}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 sm:px-6 py-1.5 sm:py-2 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg text-sm sm:text-base"
            >
               New Game
            </button>
          </div>
        </div>

        {/* Paused Game Overlay */}
        {timerEnabled && !timerRunning && gameStarted && !completed && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded-lg mb-4 text-center">
            <p className="font-semibold">⏸ Game Paused - Click "▶" to resume</p>
          </div>
        )}

        {/* Sudoku Board */}
        <div className="bg-white rounded-xl shadow-lg p-2 sm:p-4 md:p-8 mb-4 sm:mb-6">
          <div className="grid grid-cols-9 gap-0 w-fit mx-auto bg-gray-400 p-1 sm:p-1.5 md:p-2 rounded-lg">
            {puzzle.map((row, rowIndex) =>
              row.map((cell, colIndex) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={getCellClasses(rowIndex, colIndex, cell)}
                  onClick={() => handleCellFocus(rowIndex, colIndex)}
                >
                  {cell === 0 ? '' : cell}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Number Selection and Controls */}
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          {/* Number Buttons */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3 text-center">Select Number</h3>
            <div className="grid grid-cols-9 gap-2 max-w-md mx-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => (
                <button
                  key={number}
                  onClick={() => handleNumberSelect(number)}
                  className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg transition-all duration-200 transform hover:scale-105 text-sm sm:text-base"
                >
                  {number}
                </button>
              ))}
            </div>
          </div>

          {/* Control Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={handleErase}
              className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 text-sm sm:text-base"
            >
               Erase
            </button>
            
            <button
              onClick={handleUndo}
              disabled={gameHistory.length === 0}
              className={`px-3 py-2 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 text-sm sm:text-base ${
                gameHistory.length === 0 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-yellow-500 hover:bg-yellow-600 text-white'
              }`}
            >
              ↶ Undo
            </button>
            
            <button
              onClick={handleReset}
              className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 text-sm sm:text-base"
            >
               Reset
            </button>
            
            <button
              onClick={() => setSelectedCell({ row: -1, col: -1 })}
              className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-2 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 text-sm sm:text-base"
            >
               Clear Selection
            </button>
          </div>

          {/* Selected Cell Info */}
          {selectedCell.row !== -1 && selectedCell.col !== -1 && (
            <div className="mt-4 text-center">
              <p className="text-gray-600 text-sm">
                Selected: Row {selectedCell.row + 1}, Column {selectedCell.col + 1}
                {originalPuzzle[selectedCell.row][selectedCell.col] !== 0 && 
                  <span className="text-red-500 font-semibold"> (Original - Cannot Edit)</span>
                }
              </p>
            </div>
          )}
        </div>

        {/* Success Message */}
        {completed && (
          <div className="mt-4 sm:mt-6 md:mt-8 text-center">
            <div className="bg-green-500 text-white rounded-xl p-4 sm:p-6 shadow-2xl animate-bounce">
              <div className="text-2xl sm:text-3xl mb-2">Success!</div>
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-2">Congratulations!</h2>
              <p className="text-green-100 text-sm sm:text-base">
                {timerEnabled 
                  ? `You completed the puzzle in ${formatTime(elapsedTime)} with ${mistakes} mistakes!`
                  : `You completed the puzzle with ${mistakes} mistakes!`
                }
              </p>
            </div>
          </div>
        )}

        {/* Game Instructions */}
        <div className="mt-4 sm:mt-6 md:mt-8 bg-white/80 backdrop-blur-sm rounded-xl p-4 sm:p-6 text-gray-700">
          <h3 className="text-lg sm:text-xl font-bold mb-4">How to Play:</h3>
          <div className="grid sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
            <div>
              ~ Click a cell to select it, then click a number button <br/>
              ~ Fill each row with numbers 1-9 <br/>
              ~ Fill each column with numbers 1-9 <br/>
              ~ Wrong moves will be highlighted in red <br/>
              ~ Use timer controls to pause/resume or disable timing <br/>
            </div>
            <div>
              ~ Fill each 3×3 box with numbers 1-9 <br/>
              ~ Use Erase to clear cells, Undo to go back <br/>
              ~ No number should repeat in any row, column, or box <br/>
              ~ Try to minimize mistakes for a better score! <br/>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SudokuBoard;
