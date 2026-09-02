FROM gradle:8.14.3-jdk17 AS build
WORKDIR /app
COPY . .
RUN gradle bootJar --no-daemon -x test

FROM eclipse-temurin:17-jre
WORKDIR /app
EXPOSE 10000
# Use Render profile so app picks up DATABASE_JDBC_URL, DATABASE_USERNAME, DATABASE_PASSWORD at runtime
ENV SPRING_PROFILES_ACTIVE=render
COPY --from=build /app/build/libs/*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
