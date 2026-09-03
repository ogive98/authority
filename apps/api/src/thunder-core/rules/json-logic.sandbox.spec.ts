import {
  evaluateJsonLogic,
  evaluateJsonLogicWithTimeout,
} from './json-logic.sandbox';

describe('json-logic sandbox', () => {
  it('evaluates var and comparison without eval', () => {
    expect(
      evaluateJsonLogic(
        {
          and: [
            { '==': [{ var: 'payload.sku' }, 'CHEESE'] },
            { '>': [{ var: 'payload.qty' }, 0] },
          ],
        },
        { payload: { sku: 'CHEESE', qty: 2 } },
      ),
    ).toBe(true);
  });

  it('rejects unknown operators', () => {
    expect(() => evaluateJsonLogic({ eval: ['1+1'] }, {})).toThrow(
      /not allowed/,
    );
  });

  it('times out when evaluation exceeds budget', async () => {
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValueOnce(1_000).mockReturnValueOnce(1_050);
    await expect(
      evaluateJsonLogicWithTimeout({ '==': [1, 1] }, {}, 20),
    ).rejects.toThrow(/timed out/);
    now.mockRestore();
  });
});
