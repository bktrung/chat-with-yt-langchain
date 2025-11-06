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
          try {
            timeout(time: 5, unit: 'MINUTES') {
              env.useChoice = input message: "Can it be deployed?",
                paramaters: [choice(name: deploy, choice: 'no\nyes', description: 'Choose "yes" if you want to deploy')]
            }
            if (env.useChoice == 'yes) {
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
              echo "Do not confirm the deployment!"
            }
          } catch (Exception err) {
            
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
