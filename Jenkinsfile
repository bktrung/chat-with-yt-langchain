pipeline {
  agent { label 'lab-server' }

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
          sudo docker compose build --no-cache
        '''
      }
    }

    stage('Deploy Containers') {
      steps {
        script {
          def useChoice = 'no'

          try {
            timeout(time: 5, unit: 'MINUTES') {
              useChoice = input message: "Can it be deployed?",
                parameters: [choice(name: 'deploy', choices: ['no', 'yes'], description: 'Choose "yes" if you want to deploy')]
            }

            if (useChoice == 'yes') {
              sh '''
                  echo "Cleaning old containers..."
                  sudo docker compose down || true
        
                  echo "Pulling latest base images..."
                  sudo docker compose pull || true
        
                  echo "Starting containers..."
                  sudo docker compose up -d --build
        
                  echo "Cleaning unused images..."
                  sudo docker system prune -f
              '''
            } else {
              echo "User chose 'no'. Deployment skipped."
            }
          } catch (Exception err) {
            echo "Input timed out or was aborted. Aborting deployment."
            echo "Error: ${err.message}"
            currentBuild.result = 'ABORTED' 
            error("Deployment step aborted.")
          }
        }
      }
    }

    stage('Check Running Containers') {
      steps {
        sh '''
          echo "Current running containers:"
          sudo docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"
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
