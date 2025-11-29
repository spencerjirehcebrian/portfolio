.PHONY: help install dev start serve build preview clean

# Default target
help:
	@echo "Portfolio Development Commands"
	@echo "=============================="
	@echo ""
	@echo "make install  - Install dependencies"
	@echo "make dev      - Start Vite dev server (HMR enabled)"
	@echo "make start    - Alias for 'make dev'"
	@echo "make serve    - Alias for 'make dev'"
	@echo "make build    - Build for production"
	@echo "make preview  - Preview production build locally"
	@echo "make clean    - Remove build artifacts and dependencies"
	@echo ""

# Install dependencies
install:
	@echo "Installing dependencies..."
	@npm install

# Start Vite development server (with HMR)
dev:
	@echo "Starting Vite dev server..."
	@echo "Portfolio available at: http://localhost:8000"
	@echo "Press Ctrl+C to stop"
	@npm run dev

# Aliases for dev
start: dev
serve: dev

# Build for production
build:
	@echo "Building for production..."
	@npm run build
	@echo "Build complete! Output in ./dist/"

# Preview production build
preview:
	@echo "Starting preview server..."
	@echo "Preview available at: http://localhost:8000"
	@npm run preview

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf dist
	@rm -rf node_modules
	@find . -type f -name ".DS_Store" -delete 2>/dev/null || true
	@echo "Clean complete"
