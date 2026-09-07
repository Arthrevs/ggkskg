from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class SectionBase(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    code: str
    name: str
    window_start_hour: int
    window_duration_hours: int
    mega_day: str | None = None
    mega_duration_hours: int | None = None
    slot_capacity: int


class SectionCreate(SectionBase):
    pass


class SectionUpdate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    code: str | None = None
    name: str | None = None
    window_start_hour: int | None = None
    window_duration_hours: int | None = None
    mega_day: str | None = None
    mega_duration_hours: int | None = None
    slot_capacity: int | None = None


class SectionResponse(SectionBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
