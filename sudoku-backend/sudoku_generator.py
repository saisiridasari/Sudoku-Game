import random
import copy

class SudokuGenerator:
    def __init__(self):
        self.grid = [[0 for _ in range(9)] for _ in range(9)]
    
    def is_valid(self, grid, row, col, num):
        # Check row
        for x in range(9):
            if grid[row][x] == num:
                return False
        
        # Check column
        for x in range(9):
            if grid[x][col] == num:
                return False
        
        # Check 3x3 box
        start_row = row - row % 3
        start_col = col - col % 3
        for i in range(3):
            for j in range(3):
                if grid[i + start_row][j + start_col] == num:
                    return False
        
        return True
    
    def solve_sudoku(self, grid):
        for i in range(9):
            for j in range(9):
                if grid[i][j] == 0:
                    for num in range(1, 10):
                        if self.is_valid(grid, i, j, num):
                            grid[i][j] = num
                            if self.solve_sudoku(grid):
                                return True
                            grid[i][j] = 0
                    return False
        return True
    
    def generate_puzzle(self, difficulty='medium'):
        # Generate a complete solution
        self.fill_grid()
        solution = copy.deepcopy(self.grid)
        
        # Remove cells based on difficulty
        cells_to_remove = {'easy': 35, 'medium': 45, 'hard': 55}
        remove_count = cells_to_remove.get(difficulty, 45)
        
        puzzle = copy.deepcopy(solution)
        cells_removed = 0
        
        while cells_removed < remove_count:
            row = random.randint(0, 8)
            col = random.randint(0, 8)
            
            if puzzle[row][col] != 0:
                puzzle[row][col] = 0
                cells_removed += 1
        
        return puzzle, solution
    
    def fill_grid(self):
        for i in range(9):
            for j in range(9):
                if self.grid[i][j] == 0:
                    numbers = list(range(1, 10))
                    random.shuffle(numbers)
                    
                    for num in numbers:
                        if self.is_valid(self.grid, i, j, num):
                            self.grid[i][j] = num
                            if self.fill_grid():
                                return True
                            self.grid[i][j] = 0
                    return False
        return True
