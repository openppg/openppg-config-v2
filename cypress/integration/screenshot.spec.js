describe('homepage', () => {
  it('takes a screenshot', () => {
    cy.visit('/');
    cy.screenshot()
  })
})
