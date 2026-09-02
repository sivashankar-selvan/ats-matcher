"""
A curated dictionary of tech/skills keywords used for JD <-> resume matching.

This is deliberately a plain word/phrase list rather than a heavy NLP model:
it's free, fast, deterministic, and has no external dependencies or API
rate limits. Extend this list as you run the tool against real JDs and
notice terms it misses.

Each entry maps a canonical display form to its surface forms/aliases (all
treated as "the same keyword" when scanning text) and a `category`, used to
file a self-confirmed missing keyword into the matching line of the
resume's Skills section (e.g. "Kubernetes" -> the "Cloud & DevOps" line)
instead of a generic catch-all. See frontend/src/resumeEditor.ts.
"""

SKILLS: dict[str, dict] = {
    # Languages
    "Java": {"aliases": ["java"], "category": "Languages"},
    "Python": {"aliases": ["python"], "category": "Languages"},
    "JavaScript": {"aliases": ["javascript", "js"], "category": "Languages"},
    "TypeScript": {"aliases": ["typescript", "ts"], "category": "Languages"},
    "SQL": {"aliases": ["sql"], "category": "Languages"},
    "C++": {"aliases": ["c++", "cpp"], "category": "Languages"},
    "C#": {"aliases": ["c#", "csharp"], "category": "Languages"},
    "Go": {"aliases": ["golang", "go lang"], "category": "Languages"},

    # Frameworks / libraries
    "Spring Boot": {"aliases": ["spring boot", "springboot"], "category": "Frameworks"},
    "Spring Security": {"aliases": ["spring security"], "category": "Frameworks"},
    "Spring Cloud": {"aliases": ["spring cloud"], "category": "Frameworks"},
    "Angular": {"aliases": ["angular", "angular 2+", "angularjs"], "category": "Frameworks"},
    "React": {"aliases": ["react", "react.js", "reactjs"], "category": "Frameworks"},
    "Hibernate": {"aliases": ["hibernate"], "category": "Frameworks"},
    "Bootstrap": {"aliases": ["bootstrap"], "category": "Frameworks"},
    "Node.js": {"aliases": ["node.js", "nodejs", "node"], "category": "Frameworks"},
    "Express": {"aliases": ["express.js", "expressjs", "express"], "category": "Frameworks"},
    "FastAPI": {"aliases": ["fastapi"], "category": "Frameworks"},
    "Django": {"aliases": ["django"], "category": "Frameworks"},
    "Flask": {"aliases": ["flask"], "category": "Frameworks"},

    # Backend / architecture
    "REST API": {"aliases": ["rest api", "restful api", "rest apis", "restful"], "category": "Backend"},
    "Microservices": {"aliases": ["microservices", "microservice architecture"], "category": "Backend"},
    "GraphQL": {"aliases": ["graphql"], "category": "Backend"},
    "gRPC": {"aliases": ["grpc"], "category": "Backend"},
    "JWT": {"aliases": ["jwt", "json web token"], "category": "Backend"},
    "OAuth": {"aliases": ["oauth", "oauth2"], "category": "Backend"},
    "Kafka": {"aliases": ["kafka", "apache kafka"], "category": "Backend"},
    "RabbitMQ": {"aliases": ["rabbitmq"], "category": "Backend"},
    "Eureka": {"aliases": ["eureka", "netflix eureka", "service discovery"], "category": "Backend"},
    "API Gateway": {"aliases": ["api gateway", "spring cloud gateway"], "category": "Backend"},
    "Resilience4j": {"aliases": ["resilience4j", "circuit breaker"], "category": "Backend"},

    # Cloud / DevOps
    "AWS": {"aliases": ["aws", "amazon web services"], "category": "Cloud & DevOps"},
    "EC2": {"aliases": ["ec2"], "category": "Cloud & DevOps"},
    "S3": {"aliases": ["s3"], "category": "Cloud & DevOps"},
    "RDS": {"aliases": ["rds"], "category": "Cloud & DevOps"},
    "Azure": {"aliases": ["azure", "microsoft azure"], "category": "Cloud & DevOps"},
    "GCP": {"aliases": ["gcp", "google cloud"], "category": "Cloud & DevOps"},
    "Docker": {"aliases": ["docker", "containerization"], "category": "Cloud & DevOps"},
    "Kubernetes": {"aliases": ["kubernetes", "k8s"], "category": "Cloud & DevOps"},
    "Terraform": {"aliases": ["terraform"], "category": "Cloud & DevOps"},
    "CI/CD": {"aliases": ["ci/cd", "cicd", "continuous integration", "continuous deployment"], "category": "Cloud & DevOps"},
    "Jenkins": {"aliases": ["jenkins"], "category": "Cloud & DevOps"},
    "GitHub Actions": {"aliases": ["github actions"], "category": "Cloud & DevOps"},

    # Databases
    "MySQL": {"aliases": ["mysql"], "category": "Databases"},
    "PostgreSQL": {"aliases": ["postgresql", "postgres"], "category": "Databases"},
    "Oracle": {"aliases": ["oracle", "oracle db"], "category": "Databases"},
    "MongoDB": {"aliases": ["mongodb", "mongo"], "category": "Databases"},
    "Redis": {"aliases": ["redis"], "category": "Databases"},
    "DynamoDB": {"aliases": ["dynamodb"], "category": "Databases"},

    # Tools
    "Git": {"aliases": ["git"], "category": "Tools"},
    "GitHub": {"aliases": ["github"], "category": "Tools"},
    "GitLab": {"aliases": ["gitlab"], "category": "Tools"},
    "Postman": {"aliases": ["postman"], "category": "Tools"},
    "JUnit": {"aliases": ["junit"], "category": "Tools"},
    "Mockito": {"aliases": ["mockito"], "category": "Tools"},
    "Maven": {"aliases": ["maven"], "category": "Tools"},
    "Gradle": {"aliases": ["gradle"], "category": "Tools"},
    "Jira": {"aliases": ["jira"], "category": "Tools"},

    # Concepts
    "Data Structures & Algorithms": {"aliases": ["dsa", "data structures", "algorithms"], "category": "Concepts"},
    "OOP": {"aliases": ["oop", "object oriented", "object-oriented"], "category": "Concepts"},
    "DBMS": {"aliases": ["dbms"], "category": "Concepts"},
    "System Design": {"aliases": ["system design"], "category": "Concepts"},
    "Agile": {"aliases": ["agile", "scrum"], "category": "Concepts"},
    "TDD": {"aliases": ["tdd", "test driven development", "test-driven development"], "category": "Concepts"},
    "Unit Testing": {"aliases": ["unit testing", "unit tests"], "category": "Concepts"},
}

# Synonyms so a keyword's category (e.g. "Databases") can still find a
# resume's own differently-worded section label (e.g. "DB", "Platforms &
# Tools"). Used by the frontend's category-aware insertion; kept here so
# the category vocabulary and its aliases live in one place.
CATEGORY_SYNONYMS: dict[str, list[str]] = {
    "Languages": ["languages", "language", "programming languages"],
    "Frameworks": ["frameworks", "framework"],
    "Backend": ["backend", "back end", "backend development"],
    "Cloud & DevOps": ["cloud & devops", "cloud devops", "cloud", "devops", "cloud/devops"],
    "Databases": ["databases", "database", "db"],
    "Tools": ["tools", "platforms & tools", "platforms and tools", "platforms", "tooling"],
    "Concepts": ["concepts", "concept", "core concepts"],
}
