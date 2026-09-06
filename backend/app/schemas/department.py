from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class DepartmentBase(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    name: str
    short_code: str


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    name: str | None = None
    short_code: str | None = None


class DepartmentResponse(DepartmentBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
