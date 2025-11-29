.PHONY: help start serve stop clean

# Default target
help:
	@echo "Portfolio Development Commands"
	@echo "=============================="
	@echo ""
	@echo "make start    - Start development server on http://localhost:8000"
	@echo "make serve    - Alias for 'make start'"
	@echo "make stop     - Stop the development server"
	@echo "make clean    - Remove temporary files"
	@echo ""

# Start development server
start:
	@echo "Starting development server..."
	@echo "Portfolio available at: http://localhost:8000"
	@echo "Press Ctrl+C to stop"
	@python3 -m http.server 8000 --bind 127.0.0.1

# Alias for start
serve: start

# Stop server (if running in background)
stop:
	@echo "Stopping development server..."
	@-pkill -f "python3 -m http.server 8000" 2>/dev/null || echo "No server running"

# Clean temporary files
clean:
	@echo "Cleaning temporary files..."
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name ".DS_Store" -delete 2>/dev/null || true
	@echo "Clean complete"
