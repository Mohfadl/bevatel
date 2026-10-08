export class ContactNotFoundError
extends Error {
    constructor() {
        super('Contact not found',);
        this.name = 'ContactNotFoundError';
    }
}

export class DuplicateContactPhoneError
extends Error {
    constructor() {
        super('A contact with this phone number already exists',);
        this.name = 'DuplicateContactPhoneError';
    }
}

export class DuplicateContactEmailError
extends Error {
    constructor() {
        super('A contact with this email already exists',);
        this.name = 'DuplicateContactEmailError';
    }
}

export class DuplicateContactIdentityError
extends Error {
    constructor() {
        super('This contact identity already exists',);
        this.name = 'DuplicateContactIdentityError';
    }
}