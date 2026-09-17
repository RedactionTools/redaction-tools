from uuid import UUID

from ninja import Schema


class UserSchema(Schema):
    id: UUID
    email: str
    name: str
    is_staff: bool
