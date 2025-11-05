pipeline {
  agent { label 'lab-server' }

  options {
    timestamps()
    ansiColor('xterm')
  }

  environment {
    PROJECT_DIR = "${WORKSPACE}"
  }

  stages {
    stage('Environment Info') {
      steps {
        sh '''
          echo "Running as: $(whoami)"
          echo "Current directory: $(pwd)"
          docker --version
          docker compose version
        '''
      }
    }

    stage('Checkout Source') {
      steps {
        checkout scm
      }
    }

    stage('Build Containers') {
      steps {
        sh '''
          echo "Building images..."
          docker compose build --no-cache
        '''
      }
    }

    stage('Deploy Containers') {
      steps {
        sh '''
          echo "Cleaning old containers..."
          docker compose down || true

          echo "Pulling latest base images..."
          docker compose pull || true

          echo "Starting containers..."
          docker compose up -d --build

          echo "Cleaning unused images..."
          docker system prune -f
        '''
      }
    }

    stage('Check Running Containers') {
      steps {
        sh '''
          echo "Current running containers:"
          docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"
        '''
      }
    }
  }

  post {
    success {
      echo "Build & deploy succeeded on ${env.NODE_NAME}"
    }
    failure {
      echo "Deployment failed — check logs."
    }
  }
}
