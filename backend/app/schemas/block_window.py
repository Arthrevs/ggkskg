from datetime import date
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class BlockWindowBase(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    section_id: int
    week_start_date: date
    day_of_week: str
    start_minute: int
    duration_minutes: int
    slot_capacity: int


class BlockWindowCreate(BlockWindowBase):
    pass


class BlockWindowUpdate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    section_id: int | None = None
    week_start_date: date | None = None
    day_of_week: str | None = None
    start_minute: int | None = None
    duration_minutes: int | None = None
    slot_capacity: int | None = None


class BlockWindowResponse(BlockWindowBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
