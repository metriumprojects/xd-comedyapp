import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { View } from 'react-native';
import { useSwipeDownToDismiss } from '../hooks/useSwipeDownToDismiss';

describe('useSwipeDownToDismiss Hook', () => {
  let hookResult: ReturnType<typeof useSwipeDownToDismiss>;

  function TestComponent({
    visible,
    onDismiss,
    initialSlideIn = false,
  }: {
    visible: boolean;
    onDismiss: () => void;
    initialSlideIn?: boolean;
  }) {
    hookResult = useSwipeDownToDismiss({ onDismiss, visible, initialSlideIn });
    return (
      <View {...hookResult.sheetPanHandlers} style={hookResult.animatedStyle}>
        <View {...hookResult.headerPanHandlers} />
      </View>
    );
  }

  it('initializes correctly with panHandlers, headerPanHandlers, sheetPanHandlers, and animatedStyle', () => {
    const onDismiss = jest.fn();
    renderer.create(<TestComponent visible={true} onDismiss={onDismiss} />);

    expect(hookResult.panHandlers).toBeDefined();
    expect(hookResult.headerPanHandlers).toBeDefined();
    expect(hookResult.sheetPanHandlers).toBeDefined();
    expect(hookResult.animatedStyle).toBeDefined();
    expect(hookResult.animatedStyle.transform).toBeDefined();
    expect(hookResult.translateY).toBeDefined();
    expect(typeof hookResult.dismiss).toBe('function');
  });

  it('resets translateY value when reset() is called', () => {
    const onDismiss = jest.fn();
    renderer.create(<TestComponent visible={true} onDismiss={onDismiss} />);

    act(() => {
      hookResult.translateY.setValue(120);
    });
    expect((hookResult.translateY as any)._value).toBe(120);

    act(() => {
      hookResult.reset();
    });
    expect((hookResult.translateY as any)._value).toBe(0);
  });

  it('resets translateY to 0 when visible changes to true', () => {
    const onDismiss = jest.fn();
    let root: any;

    act(() => {
      root = renderer.create(<TestComponent visible={false} onDismiss={onDismiss} />);
    });

    act(() => {
      hookResult.translateY.setValue(85);
    });
    expect((hookResult.translateY as any)._value).toBe(85);

    act(() => {
      root.update(<TestComponent visible={true} onDismiss={onDismiss} />);
    });
    expect((hookResult.translateY as any)._value).toBe(0);
  });

  it('calls onDismiss when dismiss() is invoked', () => {
    jest.useFakeTimers();
    const onDismiss = jest.fn();
    renderer.create(<TestComponent visible={true} onDismiss={onDismiss} />);

    act(() => {
      hookResult.dismiss();
      jest.runAllTimers();
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
