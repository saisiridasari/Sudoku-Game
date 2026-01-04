from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime
import os
from sudoku_generator import SudokuGenerator


app = Flask(__name__)

# Configure CORS properly for production
CORS(app, resources={r"/api/*": {"origins": "*"}})


# MongoDB connection with error handling
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')

try:
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    # Test connection
    client.server_info()
    db = client['sudoku_db']
    games_collection = db['games']
    users_collection = db['users']
    print("✓ Successfully connected to MongoDB")
except Exception as e:
    print(f"✗ MongoDB connection failed: {e}")
    # Don't raise in production - let app start but handle errors in routes


# Health check endpoint (required for Render)
@app.route('/', methods=['GET'])
def home():
    return jsonify({
        "message": "Sudoku API is running",
        "status": "healthy",
        "version": "1.0.0"
    })


@app.route('/api/health', methods=['GET'])
def health_check():
    try:
        client.server_info()
        return jsonify({
            "status": "healthy",
            "database": "connected"
        })
    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e)
        }), 500


@app.route('/api/new-game', methods=['POST'])
def new_game():
    try:
        data = request.json or {}
        difficulty = data.get('difficulty', 'medium')
        user_id = data.get('user_id', 'anonymous')
        
        # Validate difficulty
        if difficulty not in ['easy', 'medium', 'hard']:
            return jsonify({'error': 'Invalid difficulty level'}), 400
        
        generator = SudokuGenerator()
        puzzle, solution = generator.generate_puzzle(difficulty)
        
        game_data = {
            'user_id': user_id,
            'puzzle': puzzle,
            'solution': solution,
            'difficulty': difficulty,
            'created_at': datetime.utcnow(),
            'completed': False,
            'time_taken': 0
        }
        
        result = games_collection.insert_one(game_data)
        
        return jsonify({
            'game_id': str(result.inserted_id),
            'puzzle': puzzle,
            'difficulty': difficulty
        })
    
    except Exception as e:
        print(f"Error in new_game: {e}")
        return jsonify({'error': 'Failed to create new game'}), 500


@app.route('/api/validate-move', methods=['POST'])
def validate_move():
    try:
        data = request.json or {}
        puzzle = data.get('puzzle')
        row = data.get('row')
        col = data.get('col')
        value = data.get('value')
        
        # Validate input
        if puzzle is None or row is None or col is None or value is None:
            return jsonify({'error': 'Missing required fields'}), 400
        
        if not (0 <= row < 9 and 0 <= col < 9 and 0 <= value <= 9):
            return jsonify({'error': 'Invalid input values'}), 400
        
        generator = SudokuGenerator()
        is_valid = generator.is_valid(puzzle, row, col, value)
        
        return jsonify({'valid': is_valid})
    
    except Exception as e:
        print(f"Error in validate_move: {e}")
        return jsonify({'error': 'Failed to validate move'}), 500


@app.route('/api/check-completion', methods=['POST'])
def check_completion():
    try:
        data = request.json or {}
        puzzle = data.get('puzzle', [])
        
        # Validate puzzle format
        if not puzzle or len(puzzle) != 9:
            return jsonify({'error': 'Invalid puzzle format'}), 400
        
        # Check if puzzle is complete
        for i in range(9):
            if len(puzzle[i]) != 9:
                return jsonify({'error': 'Invalid puzzle row length'}), 400
            for j in range(9):
                if puzzle[i][j] == 0:
                    return jsonify({'completed': False, 'valid': True})
        
        # Validate entire puzzle
        generator = SudokuGenerator()
        for i in range(9):
            for j in range(9):
                temp = puzzle[i][j]
                puzzle[i][j] = 0
                if not generator.is_valid(puzzle, i, j, temp):
                    return jsonify({'completed': False, 'valid': False})
                puzzle[i][j] = temp
        
        return jsonify({'completed': True, 'valid': True})
    
    except Exception as e:
        print(f"Error in check_completion: {e}")
        return jsonify({'error': 'Failed to check completion'}), 500


@app.route('/api/save-game', methods=['POST'])
def save_game():
    try:
        data = request.json or {}
        game_id = data.get('game_id')
        current_state = data.get('current_state')
        time_taken = data.get('time_taken', 0)
        completed = data.get('completed', False)
        
        if not game_id:
            return jsonify({'error': 'game_id is required'}), 400
        
        # Convert string ID to ObjectId
        try:
            object_id = ObjectId(game_id)
        except Exception:
            return jsonify({'error': 'Invalid game_id format'}), 400
        
        result = games_collection.update_one(
            {'_id': object_id},
            {
                '$set': {
                    'current_state': current_state,
                    'time_taken': time_taken,
                    'completed': completed,
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        if result.matched_count == 0:
            return jsonify({'error': 'Game not found'}), 404
        
        return jsonify({
            'success': True,
            'modified': result.modified_count > 0
        })
    
    except Exception as e:
        print(f"Error in save_game: {e}")
        return jsonify({'error': 'Failed to save game'}), 500


# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
