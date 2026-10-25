#import <AppSpecs/AppSpecs.h>
#import <Foundation/Foundation.h>

/**
 * O que o módulo usa da `WidgetStore` (Swift, `WidgetStore.swift`), lida
 * pelo nome em tempo de execução para não depender do cabeçalho gerado.
 */
@protocol AOWidgetStoreAPI <NSObject>
+ (BOOL)isValid:(NSString *)json;
+ (void)replace:(NSString *)json;
+ (void)signIn;
@end

/**
 * O widget "Próxima aula" para o JS (spec: src/specs/NativeHomeWidget.ts),
 * como o HomeWidgetModule.kt do Android: guarda a grade no App Group, onde a
 * extensão do widget (ios/NextClassWidget) a lê, e pede o redesenho.
 */
@interface HomeWidgetModule : NSObject <NativeHomeWidgetSpec>
@end

@implementation HomeWidgetModule

+ (NSString *)moduleName
{
  return @"HomeWidget";
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeHomeWidgetSpecJSI>(params);
}

static Class<AOWidgetStoreAPI> Store(void)
{
  return (Class<AOWidgetStoreAPI>)NSClassFromString(@"AOWidgetStore");
}

// Grade malformada: rejeita e a atual fica.
- (void)setSchedule:(NSString *)schedule
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject
{
  if (schedule.length > 0 && ![Store() isValid:schedule]) {
    reject(@"E_WIDGET_SCHEDULE", @"Malformed widget schedule", nil);
    return;
  }
  [Store() replace:schedule];
  resolve(nil);
}

- (void)setSignedIn:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [Store() signIn];
  resolve(nil);
}

@end
