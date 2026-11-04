# Etapa de construção (Build)
# Estágio de build
FROM maven:3.9.6-eclipse-temurin-21-alpine AS build
WORKDIR /app

# 1. Copie APENAS o pom.xml primeiro
COPY pom.xml .

# 2. Baixe as dependências (ficará em cache no Render, a menos que o pom.xml mude)
RUN mvn dependency:go-offline

# 3. Agora copie o código-fonte
COPY src ./src

# 4. Compile o projeto offline (rápido e sem re-downloads)
RUN mvn clean package -DskipTests -o

# Estágio de execução (o seu já deve ser parecido com este)
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]