from sqlalchemy.orm import Session
from app.models.booking import Booking
from app.schemas.booking import BookingCreate

# Add a new booking to the database
def create_booking(db: Session, booking: BookingCreate):
    db_booking = Booking(**booking.dict())
    db.add(db_booking)
    db.commit()
    db.refresh(db_booking)
    return db_booking

# Get all bookings
def get_bookings(db: Session):
    return db.query(Booking).all()

# Get booking by id
def get_booking(db: Session, booking_id: int):
    return db.query(Booking).filter(Booking.id == booking_id).first()

# Update booking status
def update_booking_status(db: Session, booking_id: int, status: str):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if booking:
        # update status field
        setattr(booking, "status", status)
        db.commit()
        db.refresh(booking)
    return booking

# Delete a booking
def delete_booking(db: Session, booking_id: int):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if booking:
        db.delete(booking)
        db.commit()
    return booking
