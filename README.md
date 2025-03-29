# CoverCraftAi

# 更新系统
sudo apt update -y && sudo apt upgrade -y

# 安装依赖
sudo apt install -y fontconfig openjdk-17-jre curl gnupg2 unzip git

# 添加 Jenkins GPG key & 源
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key | sudo tee \
  /usr/share/keyrings/jenkins-keyring.asc > /dev/null

echo deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] \
  https://pkg.jenkins.io/debian-stable binary/ | sudo tee \
  /etc/apt/sources.list.d/jenkins.list > /dev/null

# 更新并安装 Jenkins
sudo apt update -y
sudo apt install -y jenkins

# 启动 Jenkins
sudo systemctl enable jenkins
sudo systemctl start jenkins

# 安装 Docker
sudo apt install -y docker.io
sudo systemctl start docker
sudo systemctl enable docker

# 给 Jenkins 用户 Docker 权限（重启生效）
sudo usermod -aG docker jenkins

