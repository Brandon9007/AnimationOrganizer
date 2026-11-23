from sqlalchemy import Column, Integer, String, Date, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import date
from database.database import Base

class Repository(Base):
    __tablename__ = "repository"

    repository_pk = Column(Integer, primary_key=True, index=True)
    link = Column(String)
    repository_description = Column(String)
    file_name = Column(String, nullable=True)
    file_size = Column(Integer, default=0)
    created_at = Column(Date, default=date.today)
    is_active = Column(Boolean, default=True)


    project_fk = Column(Integer, ForeignKey("project.project_pk"), nullable=True)

    # Relationships
    repositorygroups = relationship("RepositoryGroups", back_populates="repository")
