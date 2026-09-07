from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "SIH26027 Automatic Block Planning System"
    debug: bool = True
    database_url: str = "sqlite:///./sih26027.db"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
