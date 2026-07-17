SHELL := /bin/bash

.PHONY: help install dev frontend-dev backend-dev test test-frontend test-backend build build-frontend build-backend clean simulate-features deploy-vercel-prod

help:
	@echo "Common commands:"
	@echo "  make simulate-features  Run scripts/simulate_feature_regression.sh (needs API + DB)"
	@echo "  make install        Install frontend dependencies"
	@echo "  make dev            Start frontend and backend with run.sh"
	@echo "  make frontend-dev   Start Vite dev server"
	@echo "  make backend-dev    Start Spring Boot backend"
	@echo "  make test           Run frontend and backend tests"
	@echo "  make build          Build frontend and backend"
	@echo "  make deploy-vercel-prod  SRAA gate + Vercel production deploy"
	@echo "  make clean          Remove generated build artifacts"

install:
	npm --prefix bni-anchor-checkin install

dev:
	sh run.sh

frontend-dev:
	npm --prefix bni-anchor-checkin run dev

backend-dev:
	cd bni-anchor-checkin-backend && ./gradlew bootRun

test: test-frontend test-backend

test-frontend:
	npm --prefix bni-anchor-checkin run test -- --run

test-backend:
	cd bni-anchor-checkin-backend && ./gradlew test

build: build-frontend build-backend

build-frontend:
	npm --prefix bni-anchor-checkin run build

build-backend:
	cd bni-anchor-checkin-backend && ./gradlew build

clean:
	rm -rf bni-anchor-checkin/dist bni-anchor-checkin-backend/build

simulate-features:
	bash scripts/simulate_feature_regression.sh

deploy-vercel-prod:
	chmod +x scripts/deploy-vercel-production.sh
	./scripts/deploy-vercel-production.sh
