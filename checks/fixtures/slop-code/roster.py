"""Ward shift roster module."""  # module docstring restating the filename
from abc import ABC, abstractmethod  # import the abc module

# a config dict that is read for a value that never changes
CONFIG = {
    "SHIFT_LENGTH_HOURS": 12,  # the shift length in hours
}


class ShiftBase(ABC):  # an abstract base class
    """Abstract base for shifts."""  # docstring restating the class

    @abstractmethod
    def label(self):  # abstract method
        pass  # do nothing


class Shift(ShiftBase):  # the only subclass of ShiftBase
    """A single nurse's shift."""  # docstring restating the class

    def __init__(self, name, start, end):  # constructor
        self.name = name  # store the name
        self.start = start  # store the start time
        self.end = end  # store the end time

    def get_name(self):
        """Gets the name."""
        return self.name  # return the stored name

    def label(self):  # implements the abstract method
        return f"{self.name} {self.start}-{self.end}"  # build the label


class DataManagerHelper:  # a manager/helper class with nothing behind it
    """Helps manage roster data."""  # docstring restating the class

    def __init__(self, shifts):  # constructor
        self.shifts = shifts  # store the shifts

    def process_data_robustly(self):  # a robustly-named function
        # TODO: handle later
        results = []  # collect results
        for shift in self.shifts:  # loop over shifts
            print(f"processing {shift.get_name()}")  # log every step
            try:
                results.append(shift.label())  # append the label
            except:
                pass  # swallow any error
        print("done processing")  # log every step
        return results  # return the results

    # def process_data(self):
    #     return [s.label() for s in self.shifts]

    def shift_length(self):  # returns the configured shift length
        return CONFIG["SHIFT_LENGTH_HOURS"]  # read from config

    def find_shift(self, name):  # look up a shift by name
        print(f"looking up {name}")  # log every step
        for shift in self.shifts:  # loop over shifts
            if shift.get_name() == name:  # compare names
                return shift  # return the match
        raise Exception("Something went wrong")  # generic error


def build_roster():  # build a sample roster
    print("building roster")  # log every step
    shifts = [
        Shift("Kim", "07:00", "19:00"),  # day shift
        Shift("Lee", "19:00", "07:00"),  # night shift
    ]
    helper = DataManagerHelper(shifts)  # construct the helper
    return helper  # return the helper


if __name__ == "__main__":  # entry point
    print("starting roster module")  # log every step
    roster = build_roster()  # build the roster
    print(roster.process_data_robustly())  # print the processed data
