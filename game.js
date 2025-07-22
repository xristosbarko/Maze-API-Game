const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

const size = 10;

let maze = generateMaze(size);
let [player, exit] = getRandomFarCells(maze);
maze[exit.y][exit.x] = 'exit';

let deathCount = 0;
let moveHistory = [];

let gameOver = false;

function getRandomFarCells(maze, minDistance = 10) {
  const empties = [];

  for (let y = 0; y < maze.length; y++) {
    for (let x = 0; x < maze[0].length; x++) {
      if (maze[y][x] === 'empty') {
        empties.push({ x, y });
      }
    }
  }

  // Shuffle the list for randomness
  for (let i = empties.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [empties[i], empties[j]] = [empties[j], empties[i]];
  }

  // Find a pair with minimum distance
  for (const a of empties) {
    for (const b of empties) {
      const dist = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      if (dist >= minDistance) {
        return [a, b];
      }
    }
  }

  // fallback if no such pair found
  return [empties[0], empties[1]];
}

function carvePathToExit(maze, size) {
  let x = size - 1;
  let y = size - 1;

  while (x !== 0 || y !== 0) {
    maze[y][x] = 'empty';  // carve this cell as empty

    // Move one step towards (0,0)
    if (x > 0 && y > 0) {
      if (Math.random() < 0.5) x--;
      else y--;
    } else if (x > 0) {
      x--;
    } else if (y > 0) {
      y--;
    }
  }
}

function generateMaze(size) {
  // Initialize grid full of walls
  const maze = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => 'wall')
  );

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // Recursive DFS carving function
  function carve(x, y) {
    maze[y][x] = 'empty';

    const directions = shuffle([
      [0, -2], // up
      [0, 2],  // down
      [-2, 0], // left
      [2, 0],  // right
    ]);

    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;

      // Check bounds and if target cell is a wall
      if (ny >= 0 && ny < size && nx >= 0 && nx < size && maze[ny][nx] === 'wall') {
        // Remove wall between current and next cell
        maze[y + dy / 2][x + dx / 2] = 'empty';
        carve(nx, ny);
      }
    }
  }

  // Make sure start is odd coordinates for maze carving
  // If size is even, reduce by 1 to keep odd
  const startX = 0;
  const startY = 0;

  carve(startX, startY);

  carvePathToExit(maze, size);

  return maze;
}

app.get('/move', (req, res) => {
  if (gameOver) {
    return res.json({ success: false, message: 'Game is over' });
  }

  let direction = req.query.direction;
  if (Array.isArray(direction)) {
    direction = direction[direction.length - 1]; // use the last one
  }

  let player_name = req.query.player_name;
  if (Array.isArray(player_name)) {
    player_name = player_name[player_name.length - 1]; // use the last one
  }

  if (!['up', 'down', 'left', 'right'].includes(direction)) {
    return res.status(400).json({ success: false, error: 'Invalid direction' });
  }

  const { x, y } = player;
  let newX = x, newY = y;
  if (direction === 'up') newY--;
  if (direction === 'down') newY++;
  if (direction === 'left') newX--;
  if (direction === 'right') newX++;

  if (newX < 0 || newY < 0 || newX >= size || newY >= size) {
    deathCount++;
    moveHistory.push({
    player_name,
    direction,
    died: true,
    timestamp: new Date().toISOString()
  });
    return res.json({ success: false, error: 'Out of bounds' });
  }

  const cell = maze[newY][newX];
  if (cell === 'wall') {
    deathCount++;
    moveHistory.push({
      player_name,
      direction,
      died: true,
      timestamp: new Date().toISOString()
    });
    return res.json({ success: false, error: 'Hit a wall' });
  }

  player = { x: newX, y: newY };

  const win = newX === exit.x && newY === exit.y;

  if (win) {
    gameOver = true;
  }

  moveHistory.push({
    player_name,
    direction,
    timestamp: new Date().toISOString()
  });

  return res.json({
    success: true,
    position: player,
    win,
    mazeView: maze,
  });
});

app.get('/state', (req, res) => {
  const win = player.x === exit.x && player.y === exit.y;
  res.json({ player, maze, exit, deathCount, moveHistory, win });
});

app.get('/reset', (req, res) => {
  maze = generateMaze(size);
  [player, exit] = getRandomFarCells(maze);
  deathCount = 0;
  moveHistory = [];
  maze[exit.y][exit.x] = 'exit';
  gameOver = false;
  res.json({ success: true, player, maze, exit, deathCount, moveHistory });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Game server running at http://localhost:${port}`);
});
