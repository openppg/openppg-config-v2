
describe('x4', () => {
  it('takes a full screenshot', () => {
    cy.visit('/configurators/x4/');
    cy.get('.navbar').invoke('css', 'position', 'absolute')
    cy.get('.fixed-top').invoke('css', 'position', 'absolute')
    cy.matchImageSnapshot();
    cy.get('.navbar').invoke('css', 'position', null)
    cy.get('.fixed-top').invoke('css', 'position', null)
  })
})

describe('sp140', () => {
  it('takes a full screenshot', () => {
    cy.visit('/configurators/sp140/');
    cy.get('.navbar').invoke('css', 'position', 'absolute')
    cy.get('.fixed-top').invoke('css', 'position', 'absolute')
    cy.matchImageSnapshot();
    cy.get('.navbar').invoke('css', 'position', null)
    cy.get('.fixed-top').invoke('css', 'position', null)
  })
})
