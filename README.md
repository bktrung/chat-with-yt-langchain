# Jenkins CI/CD Pipeline

This guide provides a complete walkthrough for setting up a CI/CD pipeline. The flow is as follows:

1.  A developer pushes a commit to a **GitHub repository**.
2.  GitHub fires a **webhook**.
3.  The Jenkins Server (Master) receives the hook and triggers a pipeline job.
4.  The job is assigned to a specific **Jenkins Agent** (the `web-server`).
5.  The Agent pulls the latest code, builds new Docker images, and redeploys the application using **Docker Compose**.

## 1\. Setup Jenkins Server (Master)

This server will run the Jenkins UI and coordinate builds. We'll use `multipass` to quickly create an Ubuntu VM.

### 1.1. Launch Server & Set Static IP

```bash
# Launch a new Ubuntu VM
multipass launch 22.04 --name jenkins-server --cpus 1 --memory 2G --disk 20G

# Enter the VM
multipass shell jenkins-server

# --- Inside the VM ---

# Edit the netplan config to set a static IP
sudo vi /etc/netplan/50-cloud-init.yaml
```

Update the `.yaml` file. **(Change the IP addresses to match your network)**.

```yaml
network:
  version: 2
  ethernets:
    ens3:
      dhcp4: no
      addresses:
        - 10.201.178.133/24 # <-- Set your static IP
      routes:
        - to: default
          via: 10.201.178.1  # <-- Set your gateway
      nameservers:
        addresses: [8.8.8.8, 8.8.4.4]

# Apply the new network configuration
sudo netplan apply
```

> **Note:** You may need to `multipass stop jenkins-server && multipass start jenkins-server` for the IP to update. From now on, `ssh` into this new static IP.

### 1.2. Install Jenkins

```bash
# --- Inside the jenkins-server VM ---

# Install Java
sudo apt update
sudo apt install -y openjdk-17-jdk openjdk-17-jre
java --version

# Add Jenkins repository key
wget -O - https://pkg.jenkins.io/debian/jenkins.io.key | sudo gpg --dearmor -o /usr/share/keyrings/jenkins-keyring.gpg

# Add Jenkins repository to sources
sudo sh -c 'echo deb [signed-by=/usr/share/keyrings/jenkins-keyring.gpg] \
  https://pkg.jenkins.io/debian-stable binary/ > /etc/apt/sources.list.d/jenkins.list'

# Update & install Jenkins
sudo apt-get update
sudo apt-get install -y jenkins

# Start and enable the Jenkins service
sudo systemctl start jenkins
sudo systemctl enable jenkins
sudo systemctl status jenkins

# Allow port 8080 through the firewall
sudo ufw allow 8080
```

### 1.3. Initial Jenkins Setup

1.  Open your browser and navigate to `http://<YOUR_STATIC_IP>:8080`.
2.  Get the initial admin password:
    ```bash
    sudo cat /var/lib/jenkins/secrets/initialAdminPassword
    ```
3.  Paste the password into the Jenkins UI.
4.  Click **"Install suggested plugins"** and wait for them to complete.
5.  Create your admin user.
   
-----

## 2\. Setup Web Server (Jenkins Agent)

This server is where your application will actually be built and deployed.

### 2.1. Launch Server & Install Dependencies

1.  Launch a new `multipass` VM (e.g., `web-server`) and set a static IP, just as in step 1.1.
2.  SSH into the new `web-server`.
3.  **Install Java:** The Java version **must match** the Jenkins master.
    ```bash
    sudo apt update
    sudo apt install -y openjdk-17-jdk
    ```
4.  **Create Jenkins User:** Create a dedicated user for the agent.
    ```bash
    sudo adduser jenkins
    # Set a password
    ```

### 2.2. Install Docker and Docker Compose

```bash
# --- Inside the web-server VM ---
sudo apt update
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce
sudo systemctl start docker
sudo systemctl enable docker
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
docker --version
docker-compose --version
```

### 2.3. Grant Docker Permissions to `jenkins` User

This is critical so Jenkins can run Docker commands without `sudo`.

```bash
# Add the 'jenkins' user to the 'docker' group
sudo usermod -aG docker jenkins

# Restart Docker for changes to take effect
sudo systemctl restart docker

# Test permissions (should not say "permission denied")
sudo -u jenkins docker ps
```

-----

## 3\. Connect Agent to Jenkins Master

Now we link the `web-server` to the `jenkins-server` UI.

### 3.1. In the Jenkins UI (Master)

1.  Go to **Manage Jenkins** → **Nodes**.
2.  Click **New Node**.
3.  **Node Name:** `web-server`
4.  Select **Permanent Agent** and click **Create**.
5.  Configure the agent:
      * **Remote root directory:** `/opt/jenkins-agent`
      * **Labels:** `web-server` (This is how the `Jenkinsfile` will find this agent)
      * **Usage:** `Use this node as much as possible`
      * **Launch method:** `Launch agent by connecting it to the master`
6.  Click **Save**. You will now see `web-server` in the list with a red 'X'. Click it.
7.  Jenkins will provide commands to connect the web server to it, just follow the instruction (choose the with secret one)

### 3.2. On the Agent Server (`web-server`)

1.  Create the remote root directory and set permissions.

    ```bash
    sudo mkdir -p /opt/jenkins-agent
    sudo chown -R jenkins:jenkins /opt/jenkins-agent
    ```

2.  Switch to the `jenkins` user.

    ```bash
    su jenkins
    cd /opt/jenkins-agent
    ```

3.  Run the agent command provided by the Jenkins UI. We add `nohup ... > nohup.out 2>&1 &` to keep it running after you log out.

4.  Go back to the Jenkins UI. The `web-server` node should now be connected with a solid icon.

-----

## 4\. Create the Jenkins Pipeline Job

This job will listen for the webhook and run the `Jenkinsfile`.

1.  In the Jenkins UI, click **New Item** on the dashboard.
2.  Enter a name (e.g., `my-app-deploy`) and select **Pipeline**. Click **OK**.
3.  In the **Build Triggers** section, check **GitHub hook trigger for GITScm polling**.
4.  In the **Pipeline** section:
      * **Definition:** `Pipeline script from SCM`
      * **SCM:** `Git`
      * **Repository URL:** `https://github.com/your-user/your-repo.git`
      * **Branch Specifier:** `*/main` (or whichever branch you want to build from)
      * **Script Path:** `Jenkinsfile` (This tells Jenkins to look for a file named `Jenkinsfile` in your repo)
5.  Click **Save**.

-----

## 5\. Configure GitHub Webhook

This tells GitHub to notify Jenkins on every push. We use `ngrok` to expose the local Jenkins server to the internet so that GitHub can hook the server.

1.  On your **local machine** (or the Jenkins server), start `ngrok` to tunnel to the Jenkins port 8080.
    ```bash
    # If you are running ngrok on the jenkins-server VM
    ngrok http 8080

    # If you are running ngrok locally and SSH tunneling
    # ssh -N -L 8080:localhost:8080 user@jenkins.devops.tech
    # ngrok http 8080
    ```
2.  `ngrok` will give you a public URL, like `https://abcd1234.ngrok.io`. Copy it.
3.  Go to your GitHub repository.
4.  Go to **Settings** → **Webhooks** → **Add webhook**.
5.  **Payload URL:** Paste your `ngrok` URL and add `/github-webhook/` to the end.
      * `https://abcd1234.ngrok.io/github-webhook/`
6.  **Content type:** `application/json`
7.  Click **Add webhook**. You should see a green checkmark, meaning GitHub successfully pinged your Jenkins server.

-----

## 6\. Create the `Jenkinsfile`

This is the most important part. Create this file in the **root of your GitHub repository**.

```groovy
// Jenkinsfile

pipeline {
  // Run this pipeline on any agent with the 'web-server' label
  agent { label 'web-server' }

  stages {
    stage('Checkout') {
      steps {
        // 'checkout scm' is a built-in step that clones
        // the repo configured in the pipeline job
        checkout scm
      }
    }

    stage('Build') {
      steps {
        sh '''          
          echo "Building images..."
          docker compose build --no-cache
        '''
      }
    }

    stage('Deploy (Down, Pull, Up)') {
      steps {
        sh '''
          echo "Bringing down old containers..."
          docker compose down || true # || true ignores errors if no containers are running
          
          echo "Pulling base images..."
          docker compose pull || true # Pull fresh base images (e.g., node, python)
          
          echo "Starting new containers..."
          docker compose up -d --build # --build forces rebuild from new code
          
          echo "Pruning old docker images/cache..."
          docker system prune -f
        '''
      }
    }

    stage('Status') {
      steps {
        sh 'docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"'
      }
    }
  }
}
```

-----

## 7\. Test the Pipeline

1.  Commit the `Jenkinsfile` to your repository and push it to the `main` branch.
    ```bash
    git add Jenkinsfile
    git commit -m "feat: Add Jenkins CI/CD pipeline"
    git push origin main
    ```
2.  This push will trigger the webhook.
3.  Go to your Jenkins UI. You will see the `my-app-deploy` job automatically start.
4.  Click the build number and then **Console Output** to watch the stages run in real-time on your `web-server`.

If everything is successful, your application is now deployed\! Any future `git push` to the `main` branch will automatically redeploy the application.

-----

### Note: Fixing Docker "Permission Denied"

If your pipeline fails with a "permission denied" error when running Docker, the `usermod` change may not have applied to the agent.

Use this `visudo` fallback on the **agent server (`web-server`)**:

1.  Open the `sudoers` editor for a new file:
    ```bash
    sudo visudo -f /etc/sudoers.d/jenkins
    ```
2.  Add this line to the file and save it:
    ```
    jenkins ALL=(ALL) NOPASSWD: /usr/bin/docker
    jenkins ALL=(ALL) NOPASSWD: /usr/local/bin/docker-compose
    ```
3.  Update your `Jenkinsfile` by adding `sudo` before every `docker` and `docker compose` command.
