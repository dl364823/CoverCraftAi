pipeline {
  agent any

  environment {
    AWS_DEFAULT_REGION = 'us-east-1'
    ECR_REPO = 'covercraft-ai'
    IMAGE_TAG = "${env.BUILD_NUMBER}"
    AWS_CREDENTIALS_ID = 'aws-covercraft'
  }

  stages {
    stage('Checkout Code') {
      steps {
        git url: 'https://github.com/dl364823/CoverCraftAi.git', branch: 'main'
      }
    }

    stage('Build Docker Image') {
      steps {
        script {
          sh 'docker build -t $ECR_REPO:$IMAGE_TAG .'
        }
      }
    }

    stage('Login to ECR') {
      steps {
        withCredentials([usernamePassword(credentialsId: "$AWS_CREDENTIALS_ID", passwordVariable: 'AWS_SECRET_ACCESS_KEY', usernameVariable: 'AWS_ACCESS_KEY_ID')]) {
          sh '''
            aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID
            aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY
            aws configure set default.region $AWS_DEFAULT_REGION

            aws ecr get-login-password | docker login --username AWS --password-stdin 368721899580.dkr.ecr.us-east-1.amazonaws.com
          '''
        }
      }
    }

    stage('Tag & Push to ECR') {
      steps {
        script {
          sh '''
            docker tag $ECR_REPO:$IMAGE_TAG 368721899580.dkr.ecr.us-east-1.amazonaws.com/$ECR_REPO:$IMAGE_TAG
            docker push 368721899580.dkr.ecr.us-east-1.amazonaws.com/$ECR_REPO:$IMAGE_TAG
          '''
        }
      }
    }

    stage('Deploy to ECS') {
      steps {
        script {
          sh '''
            aws ecs update-service \
              --cluster covercraft-cluster \
              --service covercraft-service \
              --force-new-deployment
          '''
        }
      }
    }
  }
}
